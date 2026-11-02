#!/usr/bin/env python3
"""
NRL Robot Development Server - Competition-Winning System
Complete system with AI, optimization, strategy, and advanced analytics
"""

from flask import Flask, render_template, jsonify, request
from flask_socketio import SocketIO, emit
import serial
import json
import time
import threading
from collections import deque
import numpy as np
from sklearn.ensemble import RandomForestRegressor, RandomForestClassifier
from sklearn.preprocessing import StandardScaler
import pickle
import os
import sys
import socket
import copy

app = Flask(__name__)
app.config['SECRET_KEY'] = os.getenv("SECRET_KEY", "nrl_robot_dev_server_2024")
cors_origins_env = os.getenv("CORS_ORIGINS", "*")
cors_origins = cors_origins_env.split(",") if cors_origins_env != "*" else "*"
socketio = SocketIO(app, cors_allowed_origins=cors_origins)

# ===== CONFIGURATION =====
# Use environment variables for deployment, fallback to defaults for local dev
SERIAL_PORT = os.getenv("SERIAL_PORT", "COM3")
SERIAL_BAUD = int(os.getenv("SERIAL_BAUD", "115200"))
SIMULATION_MODE = os.getenv("SIMULATION_MODE", "True").lower() == "true"
TELEMETRY_BUFFER_SIZE = 1000
PORT = int(os.getenv("PORT", "5001"))
HOST = os.getenv("HOST", "0.0.0.0")
DEBUG_MODE = os.getenv("DEBUG", "False").lower() == "true"

# ===== GLOBAL STATE =====
telemetry_buffer = deque(maxlen=TELEMETRY_BUFFER_SIZE)
current_challenge = None
serial_connection = None
serial_thread = None
serial_running = False
mock_simulator = None

# Advanced features state
run_history = []
best_runs = {'auto': None, 'main': None}
failure_modes = {
    'motor_stall': False,
    'imu_drift': False,
    'extra_friction': False,
    'battery_sag': False,
    'sensor_noise': False,
    'weight_imbalance': False
}
ml_models = {
    'drift_detector': None,
    'failure_predictor': None,
    'path_optimizer': None
}
scaler = StandardScaler()

# Hardware health monitoring state - Initialize with realistic values
hardware_health = {
    'motors': {
        'left_motor': {
            'runtime_hours': 12.5,  # 12.5 hours of runtime
            'total_power_cycles': 342,  # 342 power cycles
            'overload_count': 23,  # Some overload events
            'last_overload': time.time() - 3600,  # 1 hour ago
            'status': 'healthy'
        },
        'right_motor': {
            'runtime_hours': 12.3,  # 12.3 hours of runtime
            'total_power_cycles': 338,  # 338 power cycles
            'overload_count': 18,  # Some overload events
            'last_overload': time.time() - 7200,  # 2 hours ago
            'status': 'healthy'
        }
    },
    'battery': {
        'charge_cycles': 45,  # 45 charge cycles
        'deep_discharge_count': 2,  # 2 deep discharges
        'overheat_count': 0,
        'voltage_history': deque([3500, 3480, 3460, 3440, 3420, 3400, 3380, 3360, 3340, 3320], maxlen=100),
        'status': 'healthy'
    },
    'servos': {
        'gripper': {
            'cycles': 1250,  # 1250 cycles
            'stall_count': 3,  # 3 stalls
            'status': 'healthy'
        },
        'arm': {
            'cycles': 890,  # 890 cycles
            'stall_count': 1,  # 1 stall
            'status': 'healthy'
        }
    },
    'sensors': {
        'line_sensors': {
            'calibration_drift': 5,  # Small drift
            'status': 'healthy'
        },
        'imu': {
            'drift_detected': False,
            'status': 'healthy'
        },
        'tof': {
            'error_count': 2,  # 2 errors
            'status': 'healthy'
        }
    },
    'system': {
        'total_runtime_hours': 12.4,  # 12.4 hours total
        'start_time': time.time() - (12.4 * 3600),  # Started 12.4 hours ago
        'last_maintenance': time.time() - (15 * 86400),  # 15 days ago
        'warnings': [
            'ℹ️ System: 15 days since last maintenance. Consider scheduling routine check.',
            'ℹ️ Left Motor: 12.5 hours runtime. Motor is performing well.',
            'ℹ️ Right Motor: 12.3 hours runtime. Motor is performing well.'
        ]
    }
}

def generate_health_warnings():
    """Generate warnings based on current health state"""
    global hardware_health
    current_time = time.time()
    warnings = []
    
    # Motor warnings
    for motor_name, motor_data in hardware_health['motors'].items():
        motor_display = motor_name.replace('_', ' ').title()
        if motor_data['status'] == 'critical':
            warnings.append(f"🔴 {motor_display}: CRITICAL - Excessive overload detected! Reduce power immediately.")
        elif motor_data['status'] == 'warning':
            warnings.append(f"⚠️ {motor_display}: High overload count ({motor_data['overload_count']}). Consider reducing power.")
        if motor_data['runtime_hours'] > 100:
            warnings.append(f"ℹ️ {motor_display}: {motor_data['runtime_hours']:.1f} hours runtime. Consider maintenance check.")
        elif motor_data['runtime_hours'] > 50:
            warnings.append(f"💡 {motor_display}: {motor_data['runtime_hours']:.1f} hours runtime. Motor is performing well.")
        elif motor_data['runtime_hours'] > 10:
            warnings.append(f"✅ {motor_display}: {motor_data['runtime_hours']:.1f} hours runtime. Motor is in good condition.")
        if 10 < motor_data['overload_count'] < 50:
            warnings.append(f"💡 {motor_display}: {motor_data['overload_count']} overload events. Monitor for patterns.")
        elif motor_data['overload_count'] > 0:
            warnings.append(f"✅ {motor_display}: {motor_data['overload_count']} overload event(s). Motor is operating normally.")
        if motor_data['total_power_cycles'] > 500:
            warnings.append(f"💡 {motor_display}: {motor_data['total_power_cycles']} power cycles. Motor is being used actively.")
        elif motor_data['total_power_cycles'] > 100:
            warnings.append(f"✅ {motor_display}: {motor_data['total_power_cycles']} power cycles. Motor usage is normal.")
    
    # Battery warnings
    if hardware_health['battery']['status'] == 'critical':
        warnings.append("🔴 Battery: CRITICAL - Deep discharge detected! Charge immediately.")
    elif hardware_health['battery']['status'] == 'warning':
        warnings.append("🟡 Battery: Low voltage detected. Charge soon.")
    else:
        voltage_history = list(hardware_health['battery']['voltage_history'])
        if len(voltage_history) > 0:
            avg_voltage = sum(voltage_history) / len(voltage_history)
            if avg_voltage > 3200:
                warnings.append(f"✅ Battery: Voltage stable at ~{int(avg_voltage)}mV. Battery health is good.")
            elif avg_voltage > 3000:
                warnings.append(f"💡 Battery: Voltage at ~{int(avg_voltage)}mV. Monitor for voltage drop.")
    if hardware_health['battery']['deep_discharge_count'] > 10:
        warnings.append(f"⚠️ Battery: {hardware_health['battery']['deep_discharge_count']} deep discharges. Battery health degrading.")
    elif hardware_health['battery']['deep_discharge_count'] > 0:
        warnings.append(f"💡 Battery: {hardware_health['battery']['deep_discharge_count']} deep discharge(s). Avoid deep discharges.")
    if hardware_health['battery']['charge_cycles'] > 100:
        warnings.append(f"ℹ️ Battery: {hardware_health['battery']['charge_cycles']} charge cycles. Battery is aging.")
    elif hardware_health['battery']['charge_cycles'] > 50:
        warnings.append(f"💡 Battery: {hardware_health['battery']['charge_cycles']} charge cycles. Battery is in good condition.")
    elif hardware_health['battery']['charge_cycles'] > 0:
        warnings.append(f"✅ Battery: {hardware_health['battery']['charge_cycles']} charge cycles. Battery is healthy.")
    
    # Servo warnings
    for servo_name, servo_data in hardware_health['servos'].items():
        servo_display = servo_name.title()
        if servo_data['cycles'] > 10000:
            warnings.append(f"ℹ️ {servo_display} Servo: {servo_data['cycles']} cycles. Consider lubrication check.")
        elif servo_data['cycles'] > 5000:
            warnings.append(f"💡 {servo_display} Servo: {servo_data['cycles']} cycles. Servo is working well.")
        elif servo_data['cycles'] > 1000:
            warnings.append(f"✅ {servo_display} Servo: {servo_data['cycles']} cycles. Servo is in good condition.")
        elif servo_data['cycles'] > 0:
            warnings.append(f"✅ {servo_display} Servo: {servo_data['cycles']} cycles. Servo is operating normally.")
        if servo_data['stall_count'] > 50:
            warnings.append(f"⚠️ {servo_display} Servo: {servo_data['stall_count']} stalls detected. Check for obstructions.")
        elif servo_data['stall_count'] > 10:
            warnings.append(f"💡 {servo_display} Servo: {servo_data['stall_count']} stalls detected. Monitor for issues.")
        elif servo_data['stall_count'] > 0:
            warnings.append(f"✅ {servo_display} Servo: {servo_data['stall_count']} stall(s). Servo is operating normally.")
    
    # Sensor warnings
    if hardware_health['sensors']['line_sensors']['status'] == 'warning':
        warnings.append("🟡 Line Sensors: Calibration drift detected. Recalibrate sensors.")
    elif hardware_health['sensors']['line_sensors']['calibration_drift'] > 0:
        warnings.append(f"💡 Line Sensors: {hardware_health['sensors']['line_sensors']['calibration_drift']} drift detections. Sensors are stable.")
    else:
        warnings.append("✅ Line Sensors: Calibration is stable. No drift detected.")
    if hardware_health['sensors']['imu']['status'] == 'warning':
        warnings.append("🟡 IMU: Drift detected. Check sensor mounting and recalibrate.")
    elif hardware_health['sensors']['imu']['drift_detected']:
        warnings.append("💡 IMU: Minor drift detected. Monitor heading accuracy.")
    else:
        warnings.append("✅ IMU: No drift detected. Sensor is functioning correctly.")
    if hardware_health['sensors']['tof']['status'] == 'warning':
        warnings.append("🟡 TOF Sensor: High error rate. Check sensor connection and cleanliness.")
    elif hardware_health['sensors']['tof']['error_count'] > 5:
        warnings.append(f"💡 TOF Sensor: {hardware_health['sensors']['tof']['error_count']} errors detected. Sensor is mostly stable.")
    elif hardware_health['sensors']['tof']['error_count'] > 0:
        warnings.append(f"✅ TOF Sensor: {hardware_health['sensors']['tof']['error_count']} error(s). Sensor is operating normally.")
    else:
        warnings.append("✅ TOF Sensor: No errors detected. Sensor is functioning perfectly.")
    
    # System warnings
    runtime_hours = hardware_health['system']['total_runtime_hours']
    days_since_maintenance = (current_time - hardware_health['system']['last_maintenance']) / 86400
    if runtime_hours > 200:
        if days_since_maintenance > 30:
            warnings.append(f"⚠️ System: {days_since_maintenance:.0f} days since last maintenance. Schedule check immediately.")
        else:
            warnings.append(f"ℹ️ System: {runtime_hours:.1f} hours total runtime. High usage system.")
    elif runtime_hours > 100:
        if days_since_maintenance > 30:
            warnings.append(f"💡 System: {days_since_maintenance:.0f} days since last maintenance. Consider scheduling check.")
        else:
            warnings.append(f"✅ System: {runtime_hours:.1f} hours total runtime. System is performing well.")
    elif runtime_hours > 50:
        warnings.append(f"✅ System: {runtime_hours:.1f} hours total runtime. System is in good condition.")
    elif runtime_hours > 10:
        warnings.append(f"✅ System: {runtime_hours:.1f} hours total runtime. System is operating normally.")
    if runtime_hours > 10:
        warnings.append("💡 Performance Tip: System has significant runtime. Monitor for wear patterns and optimize PID settings.")
    if days_since_maintenance > 20:
        warnings.append(f"💡 Maintenance: {days_since_maintenance:.0f} days since last maintenance. Consider visual inspection.")
    elif days_since_maintenance > 10:
        warnings.append(f"✅ Maintenance: {days_since_maintenance:.0f} days since last maintenance. System maintenance is up to date.")
    
    hardware_health['system']['warnings'] = warnings
    return warnings

# Initialize warnings on startup
generate_health_warnings()

# ===== HARDWARE HEALTH MONITORING =====
def update_hardware_health(telemetry_data):
    """Update hardware health metrics based on telemetry"""
    global hardware_health
    
    if not telemetry_data:
        return
    
    latest = telemetry_data[-1] if isinstance(telemetry_data, list) else telemetry_data
    current_time = time.time()
    
    # Update motor health
    left_pwm = abs(latest.get('cmd', {}).get('left_pwm', 0))
    right_pwm = abs(latest.get('cmd', {}).get('right_pwm', 0))
    
    # Motor overload detection (> 90% power for extended period)
    if left_pwm > 230:  # > 90% of 255
        hardware_health['motors']['left_motor']['overload_count'] += 1
        hardware_health['motors']['left_motor']['last_overload'] = current_time
        if hardware_health['motors']['left_motor']['overload_count'] > 100:
            hardware_health['motors']['left_motor']['status'] = 'warning'
        if hardware_health['motors']['left_motor']['overload_count'] > 500:
            hardware_health['motors']['left_motor']['status'] = 'critical'
    
    if right_pwm > 230:
        hardware_health['motors']['right_motor']['overload_count'] += 1
        hardware_health['motors']['right_motor']['last_overload'] = current_time
        if hardware_health['motors']['right_motor']['overload_count'] > 100:
            hardware_health['motors']['right_motor']['status'] = 'warning'
        if hardware_health['motors']['right_motor']['overload_count'] > 500:
            hardware_health['motors']['right_motor']['status'] = 'critical'
    
    # Motor runtime tracking (approximate)
    # Calculate actual time delta from telemetry timestamps if available
    if len(telemetry_data) > 1:
        time_delta = latest.get('pc_timestamp', current_time) - telemetry_data[-2].get('pc_timestamp', current_time - 0.05)
        if time_delta <= 0 or time_delta > 1.0:  # Sanity check
            time_delta = 0.05  # Default to 50ms if invalid
    else:
        time_delta = 0.05  # Default to 50ms
    
    if left_pwm > 0 or right_pwm > 0:
        runtime_delta = time_delta / 3600  # Convert seconds to hours
        hardware_health['motors']['left_motor']['runtime_hours'] += runtime_delta if left_pwm > 0 else 0
        hardware_health['motors']['right_motor']['runtime_hours'] += runtime_delta if right_pwm > 0 else 0
        hardware_health['system']['total_runtime_hours'] += runtime_delta
    
    # Power cycle counting (when motor goes from 0 to non-zero)
    if len(telemetry_data) > 1:
        prev_left = abs(telemetry_data[-2].get('cmd', {}).get('left_pwm', 0))
        prev_right = abs(telemetry_data[-2].get('cmd', {}).get('right_pwm', 0))
        if prev_left == 0 and left_pwm > 0:
            hardware_health['motors']['left_motor']['total_power_cycles'] += 1
        if prev_right == 0 and right_pwm > 0:
            hardware_health['motors']['right_motor']['total_power_cycles'] += 1
    
    # Battery health monitoring
    battery_raw = latest.get('battery', {}).get('raw', 0)
    if battery_raw > 0:
        hardware_health['battery']['voltage_history'].append(battery_raw)
        
        # Deep discharge detection (< 2000 = critical)
        if battery_raw < 2000:
            hardware_health['battery']['deep_discharge_count'] += 1
            hardware_health['battery']['status'] = 'critical'
        elif battery_raw < 2500:
            hardware_health['battery']['status'] = 'warning'
        else:
            if hardware_health['battery']['status'] != 'healthy':
                # Reset to healthy if voltage recovers
                if battery_raw > 3000:
                    hardware_health['battery']['status'] = 'healthy'
    
    # Servo health (track position changes as cycles)
    gripper_pos = latest.get('cmd', {}).get('servo_grabber', 90)
    arm_pos = latest.get('cmd', {}).get('servo_arm', 90)
    
    if len(telemetry_data) > 1:
        prev_gripper = telemetry_data[-2].get('cmd', {}).get('servo_grabber', 90)
        prev_arm = telemetry_data[-2].get('cmd', {}).get('servo_arm', 90)
        
        if abs(gripper_pos - prev_gripper) > 5:  # Significant movement
            hardware_health['servos']['gripper']['cycles'] += 1
        if abs(arm_pos - prev_arm) > 5:
            hardware_health['servos']['arm']['cycles'] += 1
    
    # Sensor health
    line_error = abs(latest.get('line', {}).get('error', 0))
    qtr_vals = latest.get('line', {}).get('qtr', [])
    
    # Line sensor calibration drift (if all sensors read similar values, might be drift)
    if len(qtr_vals) == 8:
        sensor_variance = np.var(qtr_vals) if qtr_vals else 0
        if sensor_variance < 10000:  # Very low variance = possible drift
            hardware_health['sensors']['line_sensors']['calibration_drift'] += 1
            if hardware_health['sensors']['line_sensors']['calibration_drift'] > 50:
                hardware_health['sensors']['line_sensors']['status'] = 'warning'
    
    # IMU drift detection (if line error is consistently high, might be IMU issue)
    if line_error > 2000:
        if len(telemetry_data) > 10:
            recent_errors = [abs(d.get('line', {}).get('error', 0)) for d in telemetry_data[-10:]]
            if all(e > 1500 for e in recent_errors):
                hardware_health['sensors']['imu']['drift_detected'] = True
                hardware_health['sensors']['imu']['status'] = 'warning'
    
    # TOF sensor error detection
    tof = latest.get('distance', {}).get('tof_front', -1)
    if tof < 0 or tof > 8000:  # Invalid readings
        hardware_health['sensors']['tof']['error_count'] += 1
        if hardware_health['sensors']['tof']['error_count'] > 20:
            hardware_health['sensors']['tof']['status'] = 'warning'
    
    # Generate warnings using the centralized function
    generate_health_warnings()

def get_hardware_health_summary():
    """Get comprehensive hardware health summary"""
    global hardware_health
    
    # Calculate overall health score (0-100)
    health_score = 100
    critical_count = 0
    warning_count = 0
    
    # Check all components
    for motor_name, motor_data in hardware_health['motors'].items():
        if motor_data['status'] == 'critical':
            health_score -= 20
            critical_count += 1
        elif motor_data['status'] == 'warning':
            health_score -= 10
            warning_count += 1
    
    if hardware_health['battery']['status'] == 'critical':
        health_score -= 25
        critical_count += 1
    elif hardware_health['battery']['status'] == 'warning':
        health_score -= 15
        warning_count += 1
    
    for sensor_name, sensor_data in hardware_health['sensors'].items():
        if sensor_data['status'] == 'warning':
            health_score -= 5
            warning_count += 1
    
    health_score = max(0, health_score)
    
    # Determine overall status
    if critical_count > 0:
        overall_status = 'critical'
    elif warning_count > 0:
        overall_status = 'warning'
    else:
        overall_status = 'healthy'
    
    # Create a JSON-serializable copy of components
    # Convert deque to list for JSON serialization
    battery_copy = copy.deepcopy(hardware_health['battery'])
    if 'voltage_history' in battery_copy:
        if isinstance(battery_copy['voltage_history'], deque):
            battery_copy['voltage_history'] = list(battery_copy['voltage_history'])
        elif not isinstance(battery_copy['voltage_history'], list):
            # Fallback: try to convert to list
            try:
                battery_copy['voltage_history'] = list(battery_copy['voltage_history'])
            except:
                battery_copy['voltage_history'] = []
    
    return {
        'overall_status': overall_status,
        'health_score': health_score,
        'critical_issues': critical_count,
        'warnings': warning_count,
        'components': {
            'motors': hardware_health['motors'],
            'battery': battery_copy,
            'servos': hardware_health['servos'],
            'sensors': hardware_health['sensors']
        },
        'system': {
            'total_runtime_hours': hardware_health['system']['total_runtime_hours'],
            'last_maintenance': hardware_health['system']['last_maintenance'],
            'warnings': hardware_health['system'].get('warnings', [])
        }
    }

# ===== SCORING FUNCTIONS =====
def calculate_auto_score(corners, pickup, dropoff, lap1, lap2, lap3):
    """Calculate Auto Challenge score (max 155)"""
    return (corners * 5) + (15 if pickup else 0) + (15 if dropoff else 0) + \
           (10 if lap1 else 0) + (5 if lap2 else 0) + (5 if lap3 else 0)

def calculate_main_score(charges, golden, stacks, cs_status):
    """Calculate Main Challenge score"""
    cs_points = {'engage': 2, 'dock': 7, 'full_park': 14}.get(cs_status, 0)
    return (charges * 2) + (golden * 3) + (stacks * 5) + cs_points

# ===== SIMULATION ENGINES =====

class AutoChallengeSimulator:
    """Autonomous Challenge Simulation - 3-lap line following"""
    def __init__(self):
        self.mode = "auto_challenge"
        self.time = 0
        self.start_time = time.time()
        self.time_limit = 120  # 120 seconds
        self.running = False
        
        # Robot state
        self.x = 0.0  # Position on track (0-32 feet for 8x8 ft square)
        self.y = 0.0
        self.theta = 0.0  # Heading (radians)
        self.speed = 0
        self.turn = 0
        
        # Line following
        self.line_position = 0.0  # -1.0 to 1.0
        self.on_line = True
        self.line_lost_time = None
        
        # Challenge state
        self.lap = 0
        self.corners_completed = 0
        self.pickup_completed = False
        self.dropoff_completed = False
        self.charge_possessed = False
        
        # Sensors
        self.qtr_values = [0] * 8
        self.tof_distance = -1
        self.battery = 3500
        
    def start(self):
        self.running = True
        self.start_time = time.time()
        self.time = 0
        self.lap = 0
        self.corners_completed = 0
        self.pickup_completed = False
        self.dropoff_completed = False
        self.charge_possessed = False
        self.x = 0.0
        self.y = 0.0
        self.theta = 0.0
        
    def generate_telemetry(self):
        if not self.running:
            return None
            
        self.time = time.time() - self.start_time
        
        # Check timeout
        if self.time >= self.time_limit:
            self.running = False
            return self._final_telemetry()
        
        # Simulate line following with random sensor noise
        self.line_position += np.random.uniform(-0.15, 0.15)
        self.line_position = max(-1.0, min(1.0, self.line_position))
        
        # Check if on line (simulate line loss)
        if abs(self.line_position) > 0.8:
            if self.line_lost_time is None:
                self.line_lost_time = self.time
            elif self.time - self.line_lost_time > 10:
                self.running = False  # 10 second timeout
                return self._final_telemetry()
        else:
            self.line_lost_time = None
            self.on_line = True
        
        # PID-like line following
        base_speed = 150
        correction = -self.line_position * 50
        self.speed = base_speed
        self.turn = correction
        
        # Update position (simplified circular track)
        self.theta += (self.turn / 100.0) * 0.05
        self.x += np.cos(self.theta) * self.speed * 0.05 * 0.01
        self.y += np.sin(self.theta) * self.speed * 0.05 * 0.01
        
        # Detect corners (every ~8 feet on square track)
        track_position = (self.x + self.y) % 32
        if track_position < 0.5 and self.corners_completed < 12:
            self.corners_completed += 1
        
        # Detect pickup/dropoff zones (simplified)
        if 5.0 < self.x < 7.0 and not self.pickup_completed:
            self.pickup_completed = True
            self.charge_possessed = True
        if 15.0 < self.x < 17.0 and self.charge_possessed and not self.dropoff_completed:
            self.dropoff_completed = True
            self.charge_possessed = False
        
        # Generate QTR sensor values
        line_sensor = 3.5 + (self.line_position * 3.5)
        for i in range(8):
            distance = abs(i - line_sensor)
            if distance < 0.5:
                self.qtr_values[i] = 800 + np.random.randint(-50, 50)
            elif distance < 1.0:
                self.qtr_values[i] = 400 + np.random.randint(-50, 50)
            else:
                self.qtr_values[i] = 50 + np.random.randint(-20, 20)
        
        return {
            "mode": "auto_challenge",
            "position": {"x": self.x, "y": self.y, "theta": self.theta},
            "cmd": {
                "left_pwm": int(self.speed + self.turn),
                "right_pwm": int(self.speed - self.turn),
                "servo_grabber": 95 if self.charge_possessed else 5,
                "servo_arm": 160 if self.charge_possessed else 0
            },
            "battery": {"raw": self.battery},
            "line": {
                "error": int(self.line_position * 3500),
                "qtr": self.qtr_values.copy(),
                "on_line": self.on_line
            },
            "distance": {"tof_front": self.tof_distance},
            "encoders": {
                "left": int(self.time * 100),
                "right": int(self.time * 98)
            },
            "challenge_state": {
                "lap": self.lap,
                "corners": self.corners_completed,
                "pickup": self.pickup_completed,
                "dropoff": self.dropoff_completed,
                "charge_possessed": self.charge_possessed,
                "time_remaining": max(0, self.time_limit - self.time)
            }
        }
    
    def _final_telemetry(self):
        return {
            "mode": "auto_challenge",
            "challenge_state": {
                "lap": self.lap,
                "corners": self.corners_completed,
                "pickup": self.pickup_completed,
                "dropoff": self.dropoff_completed,
                "finished": True,
                "time_remaining": 0
            }
        }

class MainChallengeSimulator:
    """Main Challenge Simulation - PS5/WASD controlled robot on 12x12 ft field"""
    def __init__(self):
        self.mode = "main_challenge"
        self.time = 0
        self.start_time = time.time()
        self.time_limit = 150  # 2:30 match
        self.running = False
        
        # Robot state (12x12 ft field, center at 0,0, in feet)
        # Field is 12ft x 12ft = 144in, so -6 to +6 feet
        # Bottom start zone is at y = -5 to -3, center x = 0
        self.x = 0.0  # Start at center
        self.y = -4.0  # Start in bottom robot start zone (blue team)
        self.theta = 0.0  # Facing forward (toward +y)
        
        # PS5 controller input (from web)
        self.ps5_left_stick_y = 0  # -128 to 127
        self.ps5_right_stick_x = 0
        self.ps5_triangle = False
        self.ps5_cross = False
        self.ps5_square = False
        self.ps5_circle = False
        
        # WASD keyboard input
        self.key_w = False
        self.key_a = False
        self.key_s = False
        self.key_d = False
        self.key_q = False  # Arm up
        self.key_e = False  # Arm down
        self.key_z = False  # Gripper close
        self.key_x = False  # Gripper open
        
        # Robot mechanics
        self.speed = 0
        self.turn = 0
        self.arm_pos = 90
        self.gripper_pos = 90
        
        # Challenge state
        self.charges_scored = 0
        self.golden_charges = 0
        self.charge_possessed = False
        self.in_source_zone = False
        self.in_drop_zone = False
        self.charge_station_status = "none"  # none, engage, dock, full_park
        
        # Game-like charge tracking
        # Pre-placed charges in source zones (x, y positions in feet)
        self.available_charges = [
            # Top-right source zone (blue team) - 5 charges
            {"x": 5.0, "y": 5.0, "type": "blue", "picked_up": False},
            {"x": 5.3, "y": 5.0, "type": "blue", "picked_up": False},
            {"x": 5.6, "y": 5.0, "type": "blue", "picked_up": False},
            {"x": 5.0, "y": 5.3, "type": "blue", "picked_up": False},
            {"x": 5.3, "y": 5.3, "type": "blue", "picked_up": False},
            # Bottom-right source zone (red team) - 5 charges
            {"x": 5.0, "y": -5.0, "type": "red", "picked_up": False},
            {"x": 5.3, "y": -5.0, "type": "red", "picked_up": False},
            {"x": 5.6, "y": -5.0, "type": "red", "picked_up": False},
            {"x": 5.0, "y": -5.3, "type": "red", "picked_up": False},
            {"x": 5.3, "y": -5.3, "type": "red", "picked_up": False},
        ]
        self.current_charge_type = None  # "red", "blue", or None
        
        # Sensors
        self.tof_distance = -1
        self.battery = 3500
        
    def start(self):
        self.running = True
        self.start_time = time.time()
        self.time = 0
        self.charges_scored = 0
        self.golden_charges = 0
        self.charge_possessed = False
        self.current_charge_type = None
        self.x = 0.0  # Start at center of bottom start zone
        self.y = -4.0  # Start in bottom robot start zone
        self.theta = 0.0  # Facing forward (toward +y)
        # Reset all charges
        for charge in self.available_charges:
            charge["picked_up"] = False
        print(f"✓ Main Challenge simulation started - Robot at ({self.x}, {self.y})")
        
    def update_ps5_input(self, left_y, right_x, triangle, cross, square, circle):
        """Update PS5 controller input from web"""
        self.ps5_left_stick_y = int(left_y) if left_y else 0
        self.ps5_right_stick_x = int(right_x) if right_x else 0
        self.ps5_triangle = bool(triangle)
        self.ps5_cross = bool(cross)
        self.ps5_square = bool(square)
        self.ps5_circle = bool(circle)
    
    def update_keyboard_input(self, w, a, s, d, q, e, z, x):
        """Update WASD keyboard input"""
        self.key_w = w
        self.key_a = a
        self.key_s = s
        self.key_d = d
        self.key_q = q
        self.key_e = e
        self.key_z = z
        self.key_x = x
        
    def generate_telemetry(self):
        if not self.running:
            return None
            
        self.time = time.time() - self.start_time
        
        if self.time >= self.time_limit:
            self.running = False
            return self._final_telemetry()
        
        # Convert PS5 or WASD input to motor commands
        # Priority: PS5 if used, otherwise WASD
        # Frontend sends: leftStickY where positive = forward (dragging up), negative = backward
        # Frontend sends: rightStickX where positive = right turn, negative = left turn
        # Check if PS5 input is active (use smaller threshold to be more responsive)
        # Debug: Log input occasionally
        if hasattr(self, '_last_input_log') and time.time() - self._last_input_log > 2.0:
            print(f"🤖 Main Challenge Input: PS5=({self.ps5_left_stick_y}, {self.ps5_right_stick_x}), WASD=(w={self.key_w}, a={self.key_a}, s={self.key_s}, d={self.key_d})")
            self._last_input_log = time.time()
        elif not hasattr(self, '_last_input_log'):
            self._last_input_log = time.time()
        
        if abs(self.ps5_left_stick_y) > 5 or abs(self.ps5_right_stick_x) > 5:
            # Use PS5 input
            # Left stick Y: positive value (forward) -> positive speed, negative value (backward) -> negative speed
            # Right stick X: positive value (right) -> positive turn, negative value (left) -> negative turn
            speed = int(np.interp(self.ps5_left_stick_y, [-127, 127], [-255, 255]))
            turn = int(np.interp(self.ps5_right_stick_x, [-127, 127], [-255, 255]))
        else:
            # Use WASD keyboard input
            speed_val = 0
            turn_val = 0
            if self.key_w:
                speed_val = 200
            if self.key_s:
                speed_val = -200
            if self.key_a:
                turn_val = 150
            if self.key_d:
                turn_val = -150
            speed = speed_val
            turn = turn_val
        
        # Deadzones
        if abs(speed) < 20:
            speed = 0
        if abs(turn) < 20:
            turn = 0
        
        self.speed = speed
        self.turn = turn
        
        # Update position (smooth movement) - Game-like responsive controls
        dt = 0.05  # 50ms update rate
        # Convert PWM to velocity (feet per second) - More responsive
        max_speed_ft_per_sec = 4.0  # Increased max speed for better game feel
        velocity = (speed / 255.0) * max_speed_ft_per_sec
        angular_velocity = (turn / 255.0) * 3.0  # Increased turn rate for better responsiveness
        
        # Update heading
        self.theta += angular_velocity * dt
        # Normalize angle
        while self.theta > np.pi * 2:
            self.theta -= np.pi * 2
        while self.theta < 0:
            self.theta += np.pi * 2
        
        # Update position based on heading
        old_x, old_y = self.x, self.y
        self.x += np.cos(self.theta) * velocity * dt
        self.y += np.sin(self.theta) * velocity * dt
        
        # Debug: Log position changes
        if abs(old_x - self.x) > 0.01 or abs(old_y - self.y) > 0.01:
            if hasattr(self, '_last_pos_log') and time.time() - self._last_pos_log > 1.0:
                print(f"📍 Robot Position: ({self.x:.2f}, {self.y:.2f}), Theta: {self.theta:.2f}, Speed: {speed}, Turn: {turn}")
                self._last_pos_log = time.time()
            elif not hasattr(self, '_last_pos_log'):
                self._last_pos_log = time.time()
        
        # Boundary limits (12x12 ft field, keep robot within bounds)
        self.x = max(-5.8, min(5.8, self.x))  # Slightly inside boundaries
        self.y = max(-5.8, min(5.8, self.y))
        
        # Servo control (PS5 or keyboard)
        if self.ps5_triangle or self.key_q:
            self.arm_pos = 160
        if self.ps5_cross or self.key_e:
            self.arm_pos = 0
        if self.ps5_square or self.key_z:
            self.gripper_pos = 95
        if self.ps5_circle or self.key_x:
            self.gripper_pos = 5
        
        # Zone detection (based on actual field layout)
        # Source Zones: Top-right corner and bottom-right corner (each team has one)
        # Drop Zones: Top-left (red triangle) and bottom-right (blue triangle)
        # Charge Station: Center of field (-1 to 1 feet)
        
        # Source Zone (bottom-right for red team, top-right for blue)
        self.in_source_zone = (4 < self.x < 6) and ((-6 < self.y < -4) or (4 < self.y < 6))
        
        # Drop Zone (top-left red triangle, bottom-right blue triangle)
        # Red drop zone: top-left triangular area
        red_drop = (-6 < self.x < -4) and (4 < self.y < 6) and (self.y > -self.x - 2)
        # Blue drop zone: bottom-right triangular area
        blue_drop = (4 < self.x < 6) and (-6 < self.y < -4) and (self.y < -self.x + 2)
        self.in_drop_zone = red_drop or blue_drop
        
        # Charge Station: Center platform (-1 to 1 feet in both directions)
        in_charge_station = (-1 < self.x < 1) and (-1 < self.y < 1)
        
        # Game-like pickup logic: proximity-based (within 1.5 feet of a charge)
        if not self.charge_possessed and self.gripper_pos > 90:  # Gripper open
            for charge in self.available_charges:
                if charge["picked_up"]:
                    continue
                # Calculate distance to charge
                dx = self.x - charge["x"]
                dy = self.y - charge["y"]
                distance = np.sqrt(dx*dx + dy*dy)
                
                # Pick up if within 1.5 feet and gripper is open
                if distance < 1.5:
                    self.charge_possessed = True
                    self.current_charge_type = charge["type"]
                    charge["picked_up"] = True
                    print(f"🎮 Charge picked up! Type: {charge['type']}, Position: ({charge['x']:.2f}, {charge['y']:.2f})")
                    break
        
        # Dropoff logic: must be in drop zone with gripper closed
        if self.charge_possessed and self.gripper_pos < 10:  # Gripper closed
            # Check if in appropriate drop zone
            # Red charges go to top-left drop zone, blue charges go to bottom-right drop zone
            red_drop = (-6 < self.x < -4) and (4 < self.y < 6) and (self.y > -self.x - 2)
            blue_drop = (4 < self.x < 6) and (-6 < self.y < -4) and (self.y < -self.x + 2)
            
            if (self.current_charge_type == "red" and red_drop) or \
               (self.current_charge_type == "blue" and blue_drop):
                self.charges_scored += 1
                self.charge_possessed = False
                self.current_charge_type = None
                print(f"🎯 Charge scored! Total: {self.charges_scored}")
        
        # Charge Station status
        if in_charge_station:
            if abs(self.x) < 0.5 and abs(self.y) < 0.5:
                self.charge_station_status = "full_park"
            elif abs(self.x) < 1.0 and abs(self.y) < 1.0:
                self.charge_station_status = "dock"
            else:
                self.charge_station_status = "engage"
        else:
            self.charge_station_status = "none"
        
        # TOF distance (simulate obstacles)
        self.tof_distance = int(200 + np.random.randint(-50, 50))
        
        return {
            "mode": "main_challenge",
            "position": {"x": self.x, "y": self.y, "theta": self.theta},
            "cmd": {
                "left_pwm": int(self.speed + self.turn),
                "right_pwm": int(self.speed - self.turn),
                "servo_grabber": self.gripper_pos,
                "servo_arm": self.arm_pos
            },
            "battery": {"raw": self.battery},
            "line": {"error": 0, "qtr": [0]*8},
            "distance": {"tof_front": self.tof_distance},
            "encoders": {
                "left": int(self.time * 100),
                "right": int(self.time * 98)
            },
            "challenge_state": {
                "charges_scored": self.charges_scored,
                "golden_charges": self.golden_charges,
                "charge_possessed": self.charge_possessed,
                "charge_type": self.current_charge_type,
                "in_source_zone": self.in_source_zone,
                "in_drop_zone": self.in_drop_zone,
                "charge_station_status": self.charge_station_status,
                "time_remaining": max(0, self.time_limit - self.time),
                "available_charges": [c for c in self.available_charges if not c["picked_up"]]
            }
        }
    
    def _final_telemetry(self):
        return {
            "mode": "main_challenge",
            "challenge_state": {
                "charges_scored": self.charges_scored,
                "finished": True,
                "time_remaining": 0
            }
        }

# Legacy compatibility
class MockRobotSimulator:
    def __init__(self):
        self.auto_sim = AutoChallengeSimulator()
        self.main_sim = MainChallengeSimulator()
        self.current_sim = None
        
    def start_auto_challenge(self):
        self.auto_sim.start()
        self.current_sim = self.auto_sim
        
    def start_main_challenge(self):
        self.main_sim.start()
        self.current_sim = self.main_sim
        
    def generate_telemetry(self):
        if self.current_sim:
            return self.current_sim.generate_telemetry()
        return None

# ===== SERIAL/SIMULATION HANDLING =====
def read_serial():
    global serial_connection, serial_running, telemetry_buffer
    while serial_running:
        try:
            if serial_connection and serial_connection.in_waiting:
                line = serial_connection.readline().decode('utf-8', errors='ignore').strip()
                if line:
                    try:
                        data = json.loads(line)
                        data['pc_timestamp'] = time.time()
                        telemetry_buffer.append(data)
                        # Update hardware health monitoring
                        update_hardware_health(list(telemetry_buffer)[-10:])
                        socketio.emit('telemetry', data)
                    except json.JSONDecodeError:
                        pass
            time.sleep(0.01)
        except Exception as e:
            print(f"Serial error: {e}")
            time.sleep(0.1)

def read_simulation():
    global serial_running, telemetry_buffer, mock_simulator
    telemetry_count = 0
    last_log_time = time.time()
    while serial_running:
        try:
            if mock_simulator and mock_simulator.current_sim:
                data = mock_simulator.current_sim.generate_telemetry()
                if data:  # Only process if simulation is running
                    data['pc_timestamp'] = time.time()
                    telemetry_buffer.append(data)
                    # Update hardware health monitoring from simulation telemetry
                    # Pass last 10 telemetry points for trend analysis
                    recent_telemetry = list(telemetry_buffer)[-10:] if len(telemetry_buffer) >= 10 else list(telemetry_buffer)
                    if recent_telemetry:
                        update_hardware_health(recent_telemetry)
                    socketio.emit('telemetry', data)
                    telemetry_count += 1
                    # Debug: log every 2 seconds
                    if time.time() - last_log_time > 2.0:
                        pos = data.get('position', {})
                        print(f"✓ Telemetry #{telemetry_count}: mode={data.get('mode')}, pos=({pos.get('x', 0):.2f}, {pos.get('y', 0):.2f}), running={mock_simulator.current_sim.running if hasattr(mock_simulator.current_sim, 'running') else 'N/A'}")
                        last_log_time = time.time()
                else:
                    # Simulation not running or returned None
                    if time.time() - last_log_time > 2.0:
                        print(f"⚠ Simulation not generating telemetry - running: {mock_simulator.current_sim.running if hasattr(mock_simulator.current_sim, 'running') else 'N/A'}")
                        last_log_time = time.time()
            else:
                # If no simulation is running, wait a bit longer
                if time.time() - last_log_time > 2.0:
                    print("⚠ No simulation active - waiting for start...")
                    last_log_time = time.time()
                time.sleep(0.2)
                continue
            time.sleep(0.05)  # 20 Hz update rate
        except Exception as e:
            print(f"Simulation error: {e}")
            import traceback
            traceback.print_exc()
            time.sleep(0.1)

def connect_serial():
    global serial_connection, serial_thread, serial_running, mock_simulator, SIMULATION_MODE
    if SIMULATION_MODE:
        try:
            if not mock_simulator:
                mock_simulator = MockRobotSimulator()
            serial_running = True
            if not serial_thread or not serial_thread.is_alive():
                serial_thread = threading.Thread(target=read_simulation, daemon=True)
                serial_thread.start()
            print("✓ Simulation mode enabled")
            return True
        except Exception as e:
            print(f"✗ Failed to start simulation: {e}")
            import traceback
            traceback.print_exc()
            return False
    else:
        try:
            serial_connection = serial.Serial(SERIAL_PORT, SERIAL_BAUD, timeout=1)
            serial_running = True
            serial_thread = threading.Thread(target=read_serial, daemon=True)
            serial_thread.start()
            print(f"✓ Connected to {SERIAL_PORT}")
            return True
        except Exception as e:
            print(f"✗ Failed to connect: {e}")
            return False

# ===== PERFORMANCE ANALYSIS =====
def analyze_performance(data):
    if not data:
        return {}
    
    line_errors = [abs(d.get('line', {}).get('error', 0)) for d in data]
    speeds = [abs(d.get('cmd', {}).get('left_pwm', 0)) + 
              abs(d.get('cmd', {}).get('right_pwm', 0)) for d in data]
    
    analysis = {
        'avg_line_error': np.mean(line_errors) if line_errors else 0,
        'avg_speed': np.mean(speeds) if speeds else 0,
        'speed_variance': np.var(speeds) if speeds else 0,
        'recommendations': []
    }
    
    if analysis['avg_line_error'] > 1000:
        analysis['recommendations'].append("High line error - tune PID parameters")
    if analysis['speed_variance'] > 5000:
        analysis['recommendations'].append("High speed variance - reduce oscillations")
    
    return analysis

# ===== ADVANCED MODULES =====

# 4.1 Autonomous Optimization Lab
def optimize_pid_parameters(data):
    """Auto-tune PID based on performance data"""
    if not data or len(data) < 50:
        return {'kp': 2.0, 'ki': 0.1, 'kd': 0.5, 'confidence': 0.5}
    
    line_errors = [abs(d.get('line', {}).get('error', 0)) for d in data]
    avg_error = np.mean(line_errors)
    error_variance = np.var(line_errors)
    
    # Adaptive tuning
    if avg_error > 1500:
        kp = 2.5  # More aggressive
    elif avg_error < 500:
        kp = 1.5  # Less aggressive
    else:
        kp = 2.0
    
    if error_variance > 1000000:
        kd = 0.8  # More damping
    else:
        kd = 0.5
    
    return {'kp': kp, 'ki': 0.1, 'kd': kd, 'confidence': 0.8}

def train_drift_detector(data):
    """Train ML model to detect motor drift"""
    if len(data) < 100:
        return False
    
    # Extract features
    X = []
    y = []
    for i in range(len(data) - 1):
        features = [
            data[i].get('line', {}).get('error', 0),
            data[i].get('cmd', {}).get('left_pwm', 0),
            data[i].get('cmd', {}).get('right_pwm', 0),
            data[i].get('encoders', {}).get('left', 0) - data[i-1].get('encoders', {}).get('left', 0) if i > 0 else 0
        ]
        X.append(features)
        # Label: drift if line error increases significantly
        next_error = abs(data[i+1].get('line', {}).get('error', 0))
        curr_error = abs(data[i].get('line', {}).get('error', 0))
        y.append(1 if next_error > curr_error * 1.5 else 0)
    
    if len(X) > 50:
        X_scaled = scaler.fit_transform(X)
        ml_models['drift_detector'] = RandomForestClassifier(n_estimators=50)
        ml_models['drift_detector'].fit(X_scaled, y)
        return True
    return False

# 4.2 Main Challenge Strategy Engine
def optimize_strategy(charges_scored, time_remaining, golden_available):
    """Find best strategy for Main Challenge"""
    strategies = []
    
    # Strategy 1: Speed run (collect as many as possible)
    if time_remaining > 90:
        strategies.append({
            'name': 'Speed Run',
            'priority': 'Collect 8 CHARGES quickly for Supercharge',
            'route': 'Direct path: Source → Drop → Source → Drop (repeat)',
            'expected_score': charges_scored + (time_remaining / 15) * 2,
            'risk': 'Low'
        })
    
    # Strategy 2: Golden Rush (focus on Golden CHARGES)
    if time_remaining < 60 and golden_available:
        strategies.append({
            'name': 'Golden Rush',
            'priority': 'Maximize Golden CHARGE scoring',
            'route': 'Source (Golden) → Drop → Stack → Charge Station',
            'expected_score': charges_scored + 15,
            'risk': 'Medium'
        })
    
    # Strategy 3: Charge Station endgame
    if time_remaining < 30:
        strategies.append({
            'name': 'Endgame Park',
            'priority': 'Secure Charge Station points',
            'route': 'Navigate to Charge Station → Park',
            'expected_score': charges_scored + 7,
            'risk': 'Low'
        })
    
    return strategies[0] if strategies else {'name': 'Continue Current', 'priority': 'Maintain current strategy'}

# 4.3 AI Driver Assist
def ai_driver_assist(data):
    """Provide real-time driving suggestions"""
    if not data:
        return []
    
    latest = data[-1] if isinstance(data, list) else data
    suggestions = []
    
    left_pwm = abs(latest.get('cmd', {}).get('left_pwm', 0))
    right_pwm = abs(latest.get('cmd', {}).get('right_pwm', 0))
    line_error = abs(latest.get('line', {}).get('error', 0))
    battery = latest.get('battery', {}).get('raw', 0)
    
    # Collision warning
    tof = latest.get('distance', {}).get('tof_front', -1)
    if tof > 0 and tof < 100:
        suggestions.append({'type': 'warning', 'message': 'Object detected ahead - slow down!'})
    
    # Drift prediction
    if ml_models['drift_detector']:
        features = [[line_error, left_pwm, right_pwm, 0]]
        try:
            features_scaled = scaler.transform(features)
            drift_prob = ml_models['drift_detector'].predict_proba(features_scaled)[0][1]
            if drift_prob > 0.7:
                suggestions.append({'type': 'warning', 'message': 'High drift risk - reduce speed'})
        except:
            pass
    
    # Battery warning
    if battery < 2000:
        suggestions.append({'type': 'warning', 'message': 'Low battery - consider reducing power'})
    
    # Smoothness suggestion
    if abs(left_pwm - right_pwm) > 100:
        suggestions.append({'type': 'tip', 'message': 'Large speed difference - smoother turns recommended'})
    
    return suggestions

# 4.4 Performance Scoring Index (PSI)
def calculate_psi(data):
    """Calculate Performance Scoring Index (0-100)"""
    if not data or len(data) < 10:
        return {'score': 0, 'breakdown': {}}
    
    line_errors = [abs(d.get('line', {}).get('error', 0)) for d in data]
    speeds = [abs(d.get('cmd', {}).get('left_pwm', 0)) + abs(d.get('cmd', {}).get('right_pwm', 0)) for d in data]
    
    # Smoothness (inverse of acceleration variance)
    if len(speeds) > 1:
        accelerations = np.diff(speeds)
        smoothness = max(0, 100 - np.var(accelerations) / 10)
    else:
        smoothness = 50
    
    # Precision (inverse of line error)
    avg_error = np.mean(line_errors)
    precision = max(0, 100 - avg_error / 50)
    
    # Speed efficiency
    avg_speed = np.mean(speeds)
    speed_score = min(100, avg_speed / 2.55)
    
    # Stability (inverse of variance)
    stability = max(0, 100 - np.var(line_errors) / 1000)
    
    total_score = (smoothness * 0.3 + precision * 0.3 + speed_score * 0.2 + stability * 0.2)
    
    return {
        'score': round(total_score, 1),
        'breakdown': {
            'smoothness': round(smoothness, 1),
            'precision': round(precision, 1),
            'speed': round(speed_score, 1),
            'stability': round(stability, 1)
        }
    }

# 4.5 Auto-Debugger
def analyze_code_issues(data):
    """Detect code-level issues from telemetry"""
    issues = []
    
    if not data:
        return issues
    
    # Check for blocking delays
    timestamps = [d.get('pc_timestamp', 0) for d in data if 'pc_timestamp' in d]
    if len(timestamps) > 1:
        intervals = np.diff(sorted(timestamps))
        if any(intervals > 0.2):  # More than 200ms gap
            issues.append({
                'severity': 'high',
                'issue': 'Blocking delays detected',
                'fix': 'Remove delay() calls, use non-blocking timing'
            })
    
    # Check for motor overshoot
    speeds = [abs(d.get('cmd', {}).get('left_pwm', 0)) for d in data]
    if len(speeds) > 1:
        changes = np.diff(speeds)
        if any(abs(changes) > 100):
            issues.append({
                'severity': 'medium',
                'issue': 'Rapid motor changes (overshoot)',
                'fix': 'Add acceleration limiting or reduce PID gain'
            })
    
    # Check for sensor misreads
    line_errors = [abs(d.get('line', {}).get('error', 0)) for d in data]
    if np.std(line_errors) > 2000:
        issues.append({
            'severity': 'medium',
            'issue': 'High line error variance',
            'fix': 'Calibrate sensors or add filtering'
        })
    
    return issues

# 4.6 Autonomous Time Predictor
def predict_autonomous_completion(data, challenge_type='auto'):
    """Predict if robot will finish autonomous and expected score"""
    if not data or len(data) < 10:
        return {'will_finish': False, 'confidence': 0.0, 'expected_score': 0, 'risk': 'High'}
    
    elapsed = data[-1].get('pc_timestamp', 0) - data[0].get('pc_timestamp', 0)
    line_errors = [abs(d.get('line', {}).get('error', 0)) for d in data]
    avg_error = np.mean(line_errors)
    
    if challenge_type == 'auto':
        time_limit = 120
        # Estimate completion based on progress
        progress_estimate = elapsed / time_limit
        will_finish = progress_estimate < 0.8 and avg_error < 1500
        expected_score = calculate_auto_score(12, True, True, True, True, True) if will_finish else 0
    else:
        time_limit = 150
        progress_estimate = elapsed / time_limit
        will_finish = progress_estimate < 0.9
        expected_score = calculate_main_score(8, 2, 1, 'dock') if will_finish else 0
    
    risk = 'Low' if avg_error < 1000 and will_finish else 'High' if avg_error > 2000 else 'Medium'
    confidence = 0.9 if avg_error < 1000 else 0.5 if avg_error < 2000 else 0.2
    
    return {
        'will_finish': will_finish,
        'confidence': confidence,
        'expected_score': expected_score,
        'risk': risk,
        'time_remaining': time_limit - elapsed
    }

# 4.7 Match Story Generator
def generate_match_story(data, challenge_type='auto'):
    """AI-generated analysis of entire match"""
    if not data or len(data) < 50:
        return "Not enough data to generate match story."
    
    analysis = analyze_performance(data)
    psi = calculate_psi(data)
    issues = analyze_code_issues(data)
    
    story = f"Match Analysis ({challenge_type.upper()} Challenge):\n\n"
    story += f"Performance Score: {psi['score']}/100\n"
    story += f"  - Smoothness: {psi['breakdown']['smoothness']}/100\n"
    story += f"  - Precision: {psi['breakdown']['precision']}/100\n"
    story += f"  - Speed: {psi['breakdown']['speed']}/100\n"
    story += f"  - Stability: {psi['breakdown']['stability']}/100\n\n"
    
    story += "Key Observations:\n"
    if analysis.get('avg_line_error', 0) > 1000:
        story += "⚠️ High line following error detected. Robot struggled to stay on line.\n"
    if analysis.get('speed_variance', 0) > 5000:
        story += "⚠️ High speed variance. Robot showed oscillating behavior.\n"
    if psi['score'] > 80:
        story += "✅ Excellent overall performance!\n"
    elif psi['score'] < 50:
        story += "❌ Performance needs significant improvement.\n"
    
    if issues:
        story += "\nTechnical Issues Found:\n"
        for issue in issues:
            story += f"  - {issue['issue']}: {issue['fix']}\n"
    
    story += "\nRecommendations:\n"
    for rec in analysis.get('recommendations', []):
        story += f"  • {rec}\n"
    
    return story

# 4.8 Perfect Autonomous Generator
def generate_optimal_path(data, challenge_type='auto'):
    """Generate optimal autonomous path based on past performance"""
    if not data:
        return {'path': [], 'speeds': [], 'recommendations': []}
    
    analysis = analyze_performance(data)
    optimal_speed = min(200, max(100, analysis.get('avg_speed', 150) * 0.9))
    
    if challenge_type == 'auto':
        return {
            'path': ['Start', 'Corner1', 'PickupSpur', 'Corner2', 'DropoffSpur', 'Corner3', 'Corner4', 'Repeat'],
            'speeds': [optimal_speed] * 8,
            'recommendations': [
                f'Use base speed: {int(optimal_speed)}',
                'Reduce speed to 80 in spurs',
                'Increase speed to 180 on straight sections'
            ]
        }
    else:
        return {
            'path': ['Start', 'SourceZone', 'DropZone', 'SourceZone', 'DropZone', 'ChargeStation'],
            'speeds': [optimal_speed, 120, optimal_speed, 120, optimal_speed, 100],
            'recommendations': [
                f'Optimal speed: {int(optimal_speed)}',
                'Focus on 8 CHARGES for Supercharge',
                'Park in Charge Station in final 30s'
            ]
        }

# ===== FAKE DRIVING DATA GENERATOR =====
def generate_fake_driving_data(duration_seconds=30, driver_skill='intermediate'):
    """
    Generate realistic fake driving telemetry data for testing AI assistant
    
    Args:
        duration_seconds: How long the driving session should be (default 30s)
        driver_skill: 'beginner', 'intermediate', or 'advanced'
    
    Returns:
        List of telemetry packets
    """
    import random
    
    data = []
    num_samples = duration_seconds * 20  # 20 Hz sampling rate
    base_time = time.time() - duration_seconds
    
    # Skill-based parameters
    skill_params = {
        'beginner': {
            'smoothness': 0.3,  # Low smoothness (jerky)
            'precision': 0.4,   # Low precision (overshoots)
            'speed_variance': 0.5,  # High variance
            'line_error_base': 1500,  # Higher line error
            'reaction_time': 0.3  # Slower reactions
        },
        'intermediate': {
            'smoothness': 0.6,
            'precision': 0.65,
            'speed_variance': 0.3,
            'line_error_base': 800,
            'reaction_time': 0.15
        },
        'advanced': {
            'smoothness': 0.85,
            'precision': 0.9,
            'speed_variance': 0.15,
            'line_error_base': 300,
            'reaction_time': 0.05
        }
    }
    
    params = skill_params.get(driver_skill, skill_params['intermediate'])
    
    # Simulate driving patterns
    position_x = 0.0
    position_y = -4.0  # Start position
    theta = 0.0
    base_speed = 150  # Base PWM value
    
    for i in range(num_samples):
        t = i / 20.0  # Time in seconds
        
        # Simulate different driving scenarios
        if t < 5:
            # Scenario 1: Starting up - jerky acceleration
            speed_factor = min(1.0, t / 3.0)
            left_pwm = int(base_speed * speed_factor + random.uniform(-30, 30) * params['speed_variance'])
            right_pwm = int(base_speed * speed_factor + random.uniform(-30, 30) * params['speed_variance'])
            line_error = random.uniform(-params['line_error_base'] * 1.5, params['line_error_base'] * 1.5)
            
        elif t < 10:
            # Scenario 2: Turning - overshooting
            turn_amount = np.sin(t * 0.5) * 50
            left_pwm = int(base_speed + turn_amount + random.uniform(-40, 40) * params['speed_variance'])
            right_pwm = int(base_speed - turn_amount + random.uniform(-40, 40) * params['speed_variance'])
            line_error = np.sin(t * 0.5) * params['line_error_base'] * (2 - params['precision'])
            
        elif t < 15:
            # Scenario 3: Straight driving - varying smoothness
            smoothness_noise = random.uniform(-1, 1) * (1 - params['smoothness']) * 50
            left_pwm = int(base_speed + smoothness_noise)
            right_pwm = int(base_speed + smoothness_noise)
            line_error = random.uniform(-params['line_error_base'], params['line_error_base'])
            
        elif t < 20:
            # Scenario 4: Sharp turn - high error
            turn_intensity = np.sin(t * 0.8) * 80
            left_pwm = int(base_speed + turn_intensity)
            right_pwm = int(base_speed - turn_intensity)
            line_error = np.sin(t * 0.8) * params['line_error_base'] * 2
            
        elif t < 25:
            # Scenario 5: Deceleration - jerky stops
            decel_factor = max(0.3, 1.0 - (t - 20) / 5.0)
            left_pwm = int(base_speed * decel_factor + random.uniform(-60, 60) * params['speed_variance'])
            right_pwm = int(base_speed * decel_factor + random.uniform(-60, 60) * params['speed_variance'])
            line_error = random.uniform(-params['line_error_base'] * 1.2, params['line_error_base'] * 1.2)
            
        else:
            # Scenario 6: Recovery - improving
            improvement = min(1.0, (t - 25) / 5.0)
            smoothness_adj = params['smoothness'] + (1 - params['smoothness']) * improvement * 0.5
            left_pwm = int(base_speed + random.uniform(-30, 30) * (1 - smoothness_adj))
            right_pwm = int(base_speed + random.uniform(-30, 30) * (1 - smoothness_adj))
            line_error = random.uniform(-params['line_error_base'] * (1 - improvement * 0.5), 
                                       params['line_error_base'] * (1 - improvement * 0.5))
        
        # Update position (simplified)
        speed = (abs(left_pwm) + abs(right_pwm)) / 2.0
        turn_rate = (right_pwm - left_pwm) / 255.0 * 0.1
        theta += turn_rate
        position_x += np.cos(theta) * speed / 255.0 * 0.1
        position_y += np.sin(theta) * speed / 255.0 * 0.1
        
        # Generate QTR sensor array (8 sensors)
        qtr_vals = []
        center_sensor = 3.5  # Center of 8 sensors
        line_position = line_error / 500.0  # Normalized line position
        for sensor_idx in range(8):
            distance_from_line = abs(sensor_idx - (center_sensor + line_position))
            # Sensor reads high (1000) when on line, low (0) when off
            qtr_val = max(0, int(1000 - distance_from_line * 200))
            qtr_vals.append(qtr_val)
        
        # Create telemetry packet
        packet = {
            'mode': 'manual',
            'position': {
                'x': position_x,
                'y': position_y,
                'theta': theta
            },
            'cmd': {
                'left_pwm': int(left_pwm),
                'right_pwm': int(right_pwm),
                'servo_grabber': 90,
                'servo_arm': 90
            },
            'battery': {
                'raw': int(3500 - random.uniform(0, 200))  # Slight battery drain
            },
            'line': {
                'error': int(line_error),
                'qtr': qtr_vals
            },
            'distance': {
                'tof_front': int(500 + random.uniform(-50, 50))  # No obstacles
            },
            'encoders': {
                'left': int(i * 10 + random.uniform(-5, 5)),
                'right': int(i * 10 + random.uniform(-5, 5))
            },
            'pc_timestamp': base_time + t
        }
        
        data.append(packet)
    
    return data

# Enhanced Chatbot
def chatbot_response(query, context_data=None):
    query_lower = query.lower()
    recent = list(telemetry_buffer)[-100:] if telemetry_buffer else []
    recent_full = list(telemetry_buffer)[-500:] if telemetry_buffer else []
    
    # Driver improvement questions
    if any(word in query_lower for word in ['how can i improve', 'how to improve', 'driver improve', 'better driver', 'improve driving', 'what should i do better']):
        if recent:
            psi = calculate_psi(recent)
            analysis = analyze_performance(recent)
            suggestions = []
            
            # Smoothness suggestions
            if psi['breakdown']['smoothness'] < 70:
                suggestions.append("SMOOTHNESS: Your movements are jerky. Practice gradual acceleration and deceleration. Avoid sudden stops and starts.")
            
            # Precision suggestions
            if psi['breakdown']['precision'] < 70:
                suggestions.append("PRECISION: You're overshooting turns. Try smaller, more controlled movements. Anticipate turns earlier.")
            
            # Speed suggestions
            if psi['breakdown']['speed'] < 50:
                suggestions.append("SPEED: You're driving too conservatively. Increase speed gradually while maintaining control.")
            elif psi['breakdown']['speed'] > 90:
                suggestions.append("SPEED: You're driving too aggressively. Slow down slightly for better precision and control.")
            
            # Stability suggestions
            if psi['breakdown']['stability'] < 70:
                suggestions.append("STABILITY: Your robot is oscillating. Make smoother corrections and avoid over-correcting.")
            
            # Line error specific
            if analysis.get('avg_line_error', 0) > 1000:
                suggestions.append("LINE FOLLOWING: High line error detected. Focus on keeping the robot centered on the line.")
            
            # Speed variance
            if analysis.get('speed_variance', 0) > 5000:
                suggestions.append("SPEED CONSISTENCY: Your speed varies too much. Try maintaining a more constant speed.")
            
            if not suggestions:
                suggestions.append("Great job! Your driving is excellent. Focus on maintaining consistency and optimizing your strategy.")
            
            return f"Driver Improvement Suggestions (PSI: {psi['score']}/100):\n\n" + "\n\n".join(suggestions)
        return "I need recent driving data to provide improvement suggestions. Start driving in Main Challenge mode."
    
    # What changes should we make / modifications / improvements to robot
    if any(word in query_lower for word in ['what changes', 'what should we change', 'modifications', 'improve robot', 'fix robot', 'what to change', 'suggestions for robot']):
        if recent:
            psi = calculate_psi(recent)
            analysis = analyze_performance(recent)
            issues = analyze_code_issues(recent)
            pid_params = optimize_pid_parameters(recent)
            
            suggestions = []
            
            # PID tuning suggestions
            if analysis.get('avg_line_error', 0) > 1000:
                suggestions.append(f"PID TUNING: Line error is high ({analysis.get('avg_line_error', 0):.1f}). Recommended PID: Kp={pid_params['kp']:.2f}, Ki={pid_params['ki']:.3f}, Kd={pid_params['kd']:.2f}")
            
            # Speed control
            if analysis.get('speed_variance', 0) > 5000:
                suggestions.append("SPEED CONTROL: Add speed ramping/smoothing to reduce oscillations. Consider implementing acceleration limits.")
            
            # Sensor issues
            line_errors = [abs(d.get('line', {}).get('error', 0)) for d in recent]
            if max(line_errors) > 3000:
                suggestions.append("SENSOR CALIBRATION: Line sensors may need recalibration. Check sensor alignment and sensitivity.")
            
            # Code issues
            if issues:
                for issue in issues[:3]:  # Top 3 issues
                    suggestions.append(f"CODE: {issue['issue']} - {issue['fix']}")
            
            # Hardware suggestions
            speeds = [abs(d.get('cmd', {}).get('left_pwm', 0)) + abs(d.get('cmd', {}).get('right_pwm', 0)) for d in recent]
            avg_speed = np.mean(speeds) if speeds else 0
            if avg_speed < 50:
                suggestions.append("MOTOR POWER: Average speed is very low. Check motor connections and power supply.")
            
            # Stability improvements
            if psi['breakdown']['stability'] < 60:
                suggestions.append("STABILITY: Consider adding IMU-based heading control or improving PID tuning for better stability.")
            
            if not suggestions:
                suggestions.append("Robot is performing well! Consider fine-tuning PID parameters for even better performance.")
            
            return f"Robot Improvement Suggestions:\n\n" + "\n\n".join(suggestions)
        return "I need performance data to suggest improvements. Run the robot or start a simulation first."
    
    # How does the robot work / technical questions
    if any(word in query_lower for word in ['how does it work', 'how the robot works', 'how the bot works', 'explain robot', 'how does the bot', 'technical', 'architecture']):
        response = "🤖 Robot System Architecture:\n\n"
        response += "CONTROL SYSTEM:\n"
        response += "• PID Controller: Maintains line following using proportional, integral, derivative control\n"
        response += "• Line Sensors: 8 QTR sensors detect black line position\n"
        response += "• Motor Control: Differential drive with left/right PWM control\n"
        response += "• Sensor Fusion: Combines line sensors, IMU, and encoders\n\n"
        
        response += "AUTONOMOUS MODES:\n"
        response += "• Auto Challenge: Line following, 3 laps, pickup/dropoff spurs\n"
        response += "• Main Challenge: Manual control with autonomous assistance\n\n"
        
        response += "COMMUNICATION:\n"
        response += "• ESP32 streams JSON telemetry at 20-50 Hz\n"
        response += "• WebSocket connection to dashboard\n"
        response += "• Real-time data analysis and ML predictions\n\n"
        
        if recent:
            latest = recent[-1]
            response += f"CURRENT STATUS:\n"
            response += f"• Mode: {latest.get('mode', 'unknown')}\n"
            if latest.get('line', {}).get('error'):
                response += f"• Line Error: {latest.get('line', {}).get('error', 0)}\n"
            response += f"• Motors: L={latest.get('cmd', {}).get('left_pwm', 0)}, R={latest.get('cmd', {}).get('right_pwm', 0)}\n"
        
        return response
    
    # Performance questions
    if any(word in query_lower for word in ['how am i doing', 'how is my performance', 'am i doing well', 'my performance', 'performance']):
        if recent:
            psi = calculate_psi(recent)
            analysis = analyze_performance(recent)
            recommendations = []
            
            if psi['score'] > 80:
                recommendations.append("🌟 Excellent performance! You're in the top tier.")
            elif psi['score'] > 60:
                recommendations.append("✅ Good performance with room for fine-tuning.")
            else:
                recommendations.append("⚠️ Performance needs improvement. Focus on smoothness and precision.")
            
            if psi['breakdown']['smoothness'] < 60:
                recommendations.append("Work on smoother movements.")
            if psi['breakdown']['precision'] < 60:
                recommendations.append("Improve precision with smaller corrections.")
            
            return f"Your Performance Analysis:\n" \
                   f"Performance Score: {psi['score']}/100\n" \
                   f"  • Smoothness: {psi['breakdown']['smoothness']}/100\n" \
                   f"  • Precision: {psi['breakdown']['precision']}/100\n" \
                   f"  • Speed: {psi['breakdown']['speed']}/100\n" \
                   f"  • Stability: {psi['breakdown']['stability']}/100\n\n" \
                   f"Average line error: {analysis.get('avg_line_error', 0):.1f}\n" \
                   f"Average speed: {analysis.get('avg_speed', 0):.1f}\n\n" \
                   f"Recommendations:\n" + "\n".join([f"  • {r}" for r in recommendations])
        return "I need recent run data to analyze your performance. Start a simulation or connect your robot."
    
    # Bot/Robot status questions
    elif any(word in query_lower for word in ['robot status', 'where is the robot', 'where is the bot', 'robot position', 'bot status']):
        if recent:
            latest = recent[-1]
            mode = latest.get('mode', 'unknown')
            position = latest.get('position', {})
            cmd = latest.get('cmd', {})
            battery = latest.get('battery', {}).get('raw', 0)
            line_error = latest.get('line', {}).get('error', 0)
            tof = latest.get('distance', {}).get('tof_front', -1)
            
            response = f"🤖 Robot Status:\n\n"
            response += f"Mode: {mode.replace('_', ' ').title()}\n"
            if position:
                response += f"Position: X={position.get('x', 0):.2f}ft, Y={position.get('y', 0):.2f}ft\n"
                if 'theta' in position:
                    response += f"Heading: {np.degrees(position.get('theta', 0)):.1f}°\n"
            response += f"Motors: Left={cmd.get('left_pwm', 0)} PWM, Right={cmd.get('right_pwm', 0)} PWM\n"
            response += f"Battery: {battery} (raw ADC) - {'Good' if battery > 3000 else 'Low' if battery > 2000 else 'Critical'}\n"
            if line_error != 0:
                response += f"Line Error: {line_error:.1f} ({'On line' if abs(line_error) < 1000 else 'Off line'})\n"
            if tof > 0:
                response += f"Front Distance: {tof}mm\n"
            
            if mode == 'main_challenge':
                state = latest.get('challenge_state', {})
                response += f"\n📊 Challenge State:\n"
                response += f"CHARGES Scored: {state.get('charges_scored', 0)}\n"
                response += f"Has Charge: {'Yes ✓' if state.get('charge_possessed', False) else 'No'}\n"
                response += f"In Source Zone: {'Yes' if state.get('in_source_zone', False) else 'No'}\n"
                response += f"In Drop Zone: {'Yes' if state.get('in_drop_zone', False) else 'No'}\n"
                response += f"Charge Station: {state.get('charge_station_status', 'none')}\n"
                response += f"Time Remaining: {state.get('time_remaining', 0):.1f}s\n"
            elif mode == 'auto_challenge':
                state = latest.get('challenge_state', {})
                response += f"\n📊 Challenge State:\n"
                response += f"Lap: {state.get('lap', 0)}/3\n"
                response += f"Corners: {state.get('corners', 0)}/12\n"
                response += f"Pickup: {'Yes ✓' if state.get('pickup', False) else 'No'}\n"
                response += f"Dropoff: {'Yes ✓' if state.get('dropoff', False) else 'No'}\n"
                response += f"Time Remaining: {state.get('time_remaining', 0):.1f}s\n"
            
            return response
        return "I need recent telemetry to tell you about the robot. Start a simulation or connect your robot."
    
    # Sensors questions
    elif any(word in query_lower for word in ['sensors', 'sensor', 'line sensors', 'imu', 'distance sensor', 'tof']):
        if recent:
            latest = recent[-1]
            line_data = latest.get('line', {})
            tof = latest.get('distance', {}).get('tof_front', -1)
            imu = latest.get('imu', {})
            
            response = "📡 Sensor Status:\n\n"
            
            if line_data:
                qtr_vals = line_data.get('qtr', [])
                line_error = line_data.get('error', 0)
                response += f"LINE SENSORS (8 QTR sensors):\n"
                response += f"  • Line Error: {line_error:.1f}\n"
                if qtr_vals:
                    active_sensors = sum(1 for v in qtr_vals if v > 500)
                    response += f"  • Active Sensors: {active_sensors}/8\n"
                    response += f"  • Status: {'On line' if abs(line_error) < 1000 else 'Off line'}\n"
            
            if tof > 0:
                response += f"\nDISTANCE SENSOR (TOF):\n"
                response += f"  • Front Distance: {tof}mm\n"
                response += f"  • Status: {'Object detected' if tof < 200 else 'Clear'}\n"
            
            if imu:
                response += f"\nIMU:\n"
                if 'yaw' in imu:
                    response += f"  • Yaw: {imu.get('yaw', 0):.1f}°\n"
                if 'pitch' in imu:
                    response += f"  • Pitch: {imu.get('pitch', 0):.1f}°\n"
                if 'roll' in imu:
                    response += f"  • Roll: {imu.get('roll', 0):.1f}°\n"
            
            if not line_data and tof < 0 and not imu:
                response += "No sensor data available. Check sensor connections."
            
            return response
        return "I need sensor data. Start a simulation or connect your robot."
    
    # Motors questions
    elif any(word in query_lower for word in ['motors', 'motor', 'motor power', 'pwm', 'drivetrain']):
        if recent:
            speeds = [(abs(d.get('cmd', {}).get('left_pwm', 0)), abs(d.get('cmd', {}).get('right_pwm', 0))) for d in recent]
            if speeds:
                left_speeds = [s[0] for s in speeds]
                right_speeds = [s[1] for s in speeds]
                avg_left = np.mean(left_speeds)
                avg_right = np.mean(right_speeds)
                max_left = max(left_speeds)
                max_right = max(right_speeds)
                
                response = "⚙️ Motor Status:\n\n"
                response += f"LEFT MOTOR:\n"
                response += f"  • Average: {avg_left:.1f} PWM\n"
                response += f"  • Maximum: {max_left:.1f} PWM\n"
                response += f"  • Usage: {(avg_left/255*100):.1f}% of max\n\n"
                response += f"RIGHT MOTOR:\n"
                response += f"  • Average: {right_speeds[-1]:.1f} PWM\n"
                response += f"  • Maximum: {max_right:.1f} PWM\n"
                response += f"  • Usage: {(avg_right/255*100):.1f}% of max\n\n"
                
                # Check for imbalance
                diff = abs(avg_left - avg_right)
                if diff > 20:
                    response += f"⚠️ Motor Imbalance: {diff:.1f} PWM difference detected. Check motor calibration.\n"
                else:
                    response += f"✓ Motors are balanced.\n"
                
                return response
        return "I need motor data. Start a simulation or connect your robot."
    
    # Speed questions
    elif any(word in query_lower for word in ['speed', 'how fast', 'fast', 'slow']):
        if recent:
            speeds = [abs(d.get('cmd', {}).get('left_pwm', 0)) + abs(d.get('cmd', {}).get('right_pwm', 0)) for d in recent]
            avg_speed = np.mean(speeds) if speeds else 0
            max_speed = max(speeds) if speeds else 0
            return f"Speed Analysis:\n" \
                   f"Average Speed: {avg_speed:.1f} PWM\n" \
                   f"Maximum Speed: {max_speed:.1f} PWM\n" \
                   f"Percentage of Max: {(avg_speed/510*100):.1f}%\n\n" \
                   f"{'You are using good speed levels.' if 100 < avg_speed < 200 else 'Consider adjusting speed for better performance.'}"
        return "Need speed data from recent run."
    
    # Battery questions
    elif any(word in query_lower for word in ['battery', 'power', 'charge']):
        if recent:
            batteries = [d.get('battery', {}).get('raw', 0) for d in recent if 'battery' in d]
            if batteries:
                latest_battery = batteries[-1]
                avg_battery = np.mean(batteries)
                return f"Battery Status:\n" \
                       f"Current: {latest_battery} (raw ADC)\n" \
                       f"Average: {avg_battery:.0f}\n" \
                       f"Status: {'Good' if latest_battery > 3000 else 'Low' if latest_battery > 2000 else 'Critical'}\n" \
                       f"{'Battery is healthy.' if latest_battery > 3000 else 'Monitor battery levels closely.'}"
        return "Need battery data from recent run."
    
    # Line following questions
    elif any(word in query_lower for word in ['line', 'line following', 'line error', 'off line']):
        if recent:
            line_errors = [abs(d.get('line', {}).get('error', 0)) for d in recent]
            avg_error = np.mean(line_errors) if line_errors else 0
            max_error = max(line_errors) if line_errors else 0
            return f"Line Following Analysis:\n" \
                   f"Average Error: {avg_error:.1f}\n" \
                   f"Maximum Error: {max_error:.1f}\n" \
                   f"Status: {'Good tracking' if avg_error < 1000 else 'Fair tracking' if avg_error < 2000 else 'Needs tuning'}\n\n" \
                   f"Recommendation: {'Keep current settings.' if avg_error < 1000 else 'Consider tuning PID parameters.'}"
        return "Need line sensor data from recent run."
    
    # Auto challenge questions
    elif 'auto challenge' in query_lower or 'autonomous' in query_lower:
        if recent:
            pred = predict_autonomous_completion(recent, 'auto')
            return f"Auto Challenge Status:\n" \
                   f"Will finish: {'Yes' if pred['will_finish'] else 'No'} ({pred['confidence']*100:.0f}% confidence)\n" \
                   f"Expected score: {pred['expected_score']}/155\n" \
                   f"Risk level: {pred['risk']}\n" \
                   f"Time remaining: {pred.get('time_remaining', 0):.1f}s"
        return "Auto Challenge: 3-lap line following, 120s max, 155 points max. Start a simulation to see predictions."
    
    # Main challenge questions
    elif 'main challenge' in query_lower or 'battle' in query_lower:
        if recent:
            latest = recent[-1]
            state = latest.get('challenge_state', {})
            charges = state.get('charges_scored', 0)
            time_rem = state.get('time_remaining', 150)
            strategy = optimize_strategy(charges, time_rem, True)
            return f"Main Challenge Status:\n" \
                   f"CHARGES Scored: {charges}\n" \
                   f"Time Remaining: {time_rem:.1f}s\n" \
                   f"Charge Station: {state.get('charge_station_status', 'none')}\n\n" \
                   f"Strategy Recommendation:\n" \
                   f"  • {strategy.get('name', 'Continue')}\n" \
                   f"  • {strategy.get('priority', 'N/A')}\n" \
                   f"  • Expected Score: {strategy.get('expected_score', 0)}"
        return "Main Challenge: Battle of Charges, 2:30 match. Start a simulation to see strategy."
    
    # PSI questions
    elif 'psi' in query_lower or 'performance score' in query_lower:
        if recent:
            psi = calculate_psi(recent)
            return f"Performance Scoring Index: {psi['score']}/100\n" \
                   f"Smoothness: {psi['breakdown']['smoothness']}/100\n" \
                   f"Precision: {psi['breakdown']['precision']}/100\n" \
                   f"Speed: {psi['breakdown']['speed']}/100\n" \
                   f"Stability: {psi['breakdown']['stability']}/100"
        return "Need recent run data to calculate PSI. Start a simulation or connect your robot."
    
    # Match story
    elif 'story' in query_lower or 'match analysis' in query_lower or 'what happened' in query_lower:
        recent_full = list(telemetry_buffer)[-500:] if telemetry_buffer else []
        if recent_full:
            return generate_match_story(recent_full, current_challenge or 'auto')
        return "Need match data to generate story. Complete a run first."
    
    # Optimal path
    elif 'optimal' in query_lower or 'best path' in query_lower:
        if recent:
            path = generate_optimal_path(recent, current_challenge or 'auto')
            return f"Optimal Path:\n" + "\n".join([f"{i+1}. {p} @ {s}" for i, (p, s) in enumerate(zip(path['path'], path['speeds']))]) + \
                   "\n\nRecommendations:\n" + "\n".join(path['recommendations'])
        return "Need performance data to generate optimal path."
    
    # PID questions
    elif any(word in query_lower for word in ['pid', 'pid parameters', 'pid tuning', 'pid values']):
        if recent:
            pid_params = optimize_pid_parameters(recent)
            current_kp = pid_params.get('kp', 2.0)
            current_ki = pid_params.get('ki', 0.1)
            current_kd = pid_params.get('kd', 0.5)
            confidence = pid_params.get('confidence', 0.5)
            
            analysis = analyze_performance(recent)
            line_error = analysis.get('avg_line_error', 0)
            
            response = f"🎛️ PID Controller Status:\n\n"
            response += f"Current Parameters:\n"
            response += f"  • Kp (Proportional): {current_kp:.2f}\n"
            response += f"  • Ki (Integral): {current_ki:.3f}\n"
            response += f"  • Kd (Derivative): {current_kd:.2f}\n"
            response += f"  • Confidence: {confidence*100:.0f}%\n\n"
            
            response += f"Performance:\n"
            response += f"  • Average Line Error: {line_error:.1f}\n"
            
            if line_error > 1000:
                response += f"\n⚠️ Recommendation: Line error is high. Consider:\n"
                response += f"  • Increase Kp to {current_kp * 1.2:.2f} for faster response\n"
                response += f"  • Increase Kd to {current_kd * 1.3:.2f} for better damping\n"
            elif line_error < 500:
                response += f"\n✓ PID is well-tuned. Line following is accurate."
            else:
                response += f"\n→ PID is performing adequately. Fine-tuning may improve precision."
            
            return response
        return "I need performance data to analyze PID. Run the robot first."
    
    # Strategy questions
    elif any(word in query_lower for word in ['strategy', 'what should i do', 'what to do', 'recommendation', 'best strategy']):
        if recent:
            latest = recent[-1]
            mode = latest.get('mode', 'unknown')
            
            if mode == 'main_challenge':
                state = latest.get('challenge_state', {})
                charges = state.get('charges_scored', 0)
                time_rem = state.get('time_remaining', 150)
                strategy = optimize_strategy(charges, time_rem, True)
                
                response = f"🎯 Strategy Recommendation:\n\n"
                response += f"Current Status:\n"
                response += f"  • CHARGES Scored: {charges}\n"
                response += f"  • Time Remaining: {time_rem:.1f}s\n"
                response += f"  • Has Charge: {'Yes' if state.get('charge_possessed', False) else 'No'}\n\n"
                
                response += f"Recommended Strategy:\n"
                response += f"  • {strategy.get('name', 'Continue')}\n"
                response += f"  • Priority: {strategy.get('priority', 'N/A')}\n"
                response += f"  • Route: {strategy.get('route', 'N/A')}\n"
                response += f"  • Expected Score: {strategy.get('expected_score', 0)} points\n"
                response += f"  • Risk: {strategy.get('risk', 'N/A')}\n"
                
                # Add specific recommendations
                if charges < 8 and time_rem > 90:
                    response += f"\n💡 Focus on collecting 8 CHARGES quickly to unlock Supercharge mode."
                elif charges >= 8 and time_rem > 60:
                    response += f"\n💡 Supercharge unlocked! Focus on Golden CHARGES and Charge Station."
                elif time_rem < 30:
                    response += f"\n💡 Endgame: Navigate to Charge Station for parking points."
                
                return response
            elif mode == 'auto_challenge':
                state = latest.get('challenge_state', {})
                corners = state.get('corners', 0)
                time_rem = state.get('time_remaining', 120)
                
                response = f"🎯 Autonomous Challenge Strategy:\n\n"
                response += f"Progress:\n"
                response += f"  • Corners: {corners}/12\n"
                response += f"  • Time Remaining: {time_rem:.1f}s\n\n"
                
                if corners < 4:
                    response += f"💡 Focus: Complete first lap. Maintain steady speed on straight sections."
                elif corners < 8:
                    response += f"💡 Focus: Second lap. Optimize spur entry/exit for pickup/dropoff."
                else:
                    response += f"💡 Focus: Final lap. Maintain precision to finish strong."
                
                return response
        
        return "I need challenge data to provide strategy. Start a challenge first."
    
    # Help
    elif 'help' in query_lower or 'what can you' in query_lower or 'what questions' in query_lower:
        return "🤖 I'm your AI Robot Assistant! I can help with:\n\n" \
               "📊 PERFORMANCE & DRIVER:\n" \
               "  • 'How am I doing?' - Performance analysis\n" \
               "  • 'How can I improve?' - Driver improvement tips\n" \
               "  • 'What should I do better?' - Specific suggestions\n\n" \
               "🤖 ROBOT STATUS:\n" \
               "  • 'Where is the robot?' - Current position and status\n" \
               "  • 'Robot status' - Full robot information\n" \
               "  • 'How does the robot work?' - Technical explanation\n\n" \
               "⚙️ TECHNICAL:\n" \
               "  • 'Sensors' - Sensor readings and status\n" \
               "  • 'Motors' - Motor performance analysis\n" \
               "  • 'PID' - PID controller status and tuning\n" \
               "  • 'Line following' - Line tracking analysis\n\n" \
               "🎯 STRATEGY & OPTIMIZATION:\n" \
               "  • 'What should I do?' - Strategy recommendations\n" \
               "  • 'What changes should we make?' - Robot improvements\n" \
               "  • 'Optimal path' - Best route suggestions\n\n" \
               "📈 ANALYSIS:\n" \
               "  • 'PSI score' - Performance Scoring Index\n" \
               "  • 'Match story' - Complete match analysis\n" \
               "  • 'Speed' / 'Battery' - Specific metrics\n\n" \
               "💡 Try asking: 'How can I improve?', 'What changes should we make?', 'How does the robot work?'"
    
    # Default response - try to be helpful
    else:
        # Try to extract keywords and provide relevant info
        if recent:
            latest = recent[-1]
            mode = latest.get('mode', 'unknown')
            
            # Check if it's a question about something specific
            if any(word in query_lower for word in ['what', 'how', 'why', 'when', 'where']):
                return f"I can help you understand the robot and improve performance! Based on your current data:\n\n" \
                       f"• Mode: {mode.replace('_', ' ').title()}\n" \
                       f"• Ask me: 'How can I improve?', 'What changes should we make?', 'How does the robot work?', or 'help' for options"
            else:
                return f"I understand you're asking about '{query}'. I can help with:\n\n" \
                       f"• Performance analysis and driver tips\n" \
                       f"• Robot status and technical details\n" \
                       f"• Strategy recommendations\n" \
                       f"• Improvement suggestions\n\n" \
                       f"Try: 'How can I improve?', 'What changes should we make?', 'How does the robot work?', or type 'help'"
        else:
            return f"I can help you with robot performance, status, strategy, and improvements!\n\n" \
                   f"Start a simulation or connect your robot, then ask:\n" \
                   f"• 'How can I improve?' - Driver tips\n" \
                   f"• 'What changes should we make?' - Robot improvements\n" \
                   f"• 'How does the robot work?' - Technical explanation\n" \
                   f"• 'help' - See all options"

# ===== API ROUTES =====
@app.route('/')
def index():
    return render_template('dashboard.html')

@app.route('/api/telemetry')
def get_telemetry():
    return jsonify(list(telemetry_buffer)[-100:] if telemetry_buffer else [])

@app.route('/api/analysis')
def get_analysis():
    recent_data = list(telemetry_buffer)[-500:]
    return jsonify(analyze_performance(recent_data))

@app.route('/api/chatbot', methods=['POST'])
def chatbot():
    data = request.json
    query = data.get('query', '')
    recent_data = list(telemetry_buffer)[-100:] if telemetry_buffer else None
    response = chatbot_response(query, recent_data)
    return jsonify({'response': response})

@app.route('/api/start-auto-challenge', methods=['POST'])
def start_auto_challenge():
    global current_challenge, mock_simulator, serial_running
    current_challenge = 'auto'
    if SIMULATION_MODE:
        if not mock_simulator:
            mock_simulator = MockRobotSimulator()
        mock_simulator.start_auto_challenge()
        # Make sure simulation thread is running
        if not serial_running:
            connect_serial()
    elif serial_connection:
        serial_connection.write(b"start_autonomous\n")
    return jsonify({'success': True, 'challenge': 'auto'})

@app.route('/api/start-main-challenge', methods=['POST'])
def start_main_challenge():
    global current_challenge, mock_simulator, serial_running
    current_challenge = 'main'
    if SIMULATION_MODE:
        if not mock_simulator:
            mock_simulator = MockRobotSimulator()
        mock_simulator.start_main_challenge()
        # Make sure simulation thread is running
        if not serial_running:
            connect_serial()
    elif serial_connection:
        serial_connection.write(b"start_main_challenge\n")
    return jsonify({'success': True, 'challenge': 'main'})

@app.route('/api/ps5-input', methods=['POST'])
def ps5_input():
    """Receive PS5 controller input for Main Challenge simulation"""
    global mock_simulator
    if SIMULATION_MODE and mock_simulator and mock_simulator.current_sim and isinstance(mock_simulator.current_sim, MainChallengeSimulator):
        data = request.json
        # Handle both camelCase (from frontend) and snake_case
        left_y = data.get('left_stick_y') or data.get('leftStickY', 0)
        right_x = data.get('right_stick_x') or data.get('rightStickX', 0)
        mock_simulator.current_sim.update_ps5_input(
            left_y,
            right_x,
            data.get('triangle', False),
            data.get('cross', False),
            data.get('square', False),
            data.get('circle', False)
        )
        return jsonify({'success': True})
    return jsonify({'success': False, 'error': 'Not in Main Challenge simulation'})

@app.route('/api/keyboard-input', methods=['POST'])
def keyboard_input():
    """Receive WASD keyboard input for Main Challenge simulation"""
    global mock_simulator
    if SIMULATION_MODE and mock_simulator and mock_simulator.current_sim and isinstance(mock_simulator.current_sim, MainChallengeSimulator):
        data = request.json
        mock_simulator.current_sim.update_keyboard_input(
            data.get('w', False),
            data.get('a', False),
            data.get('s', False),
            data.get('d', False),
            data.get('q', False),
            data.get('e', False),
            data.get('z', False),
            data.get('x', False)
        )
        return jsonify({'success': True})
    return jsonify({'success': False, 'error': 'Not in Main Challenge simulation'})

@app.route('/api/start-simulation', methods=['POST'])
def start_simulation():
    global telemetry_buffer, mock_simulator
    telemetry_buffer.clear()
    if not serial_running:
        connect_serial()
    if SIMULATION_MODE and mock_simulator:
        # Default to auto challenge if no challenge selected
        if current_challenge == 'auto':
            mock_simulator.start_auto_challenge()
        elif current_challenge == 'main':
            mock_simulator.start_main_challenge()
    return jsonify({'success': True, 'run_id': 1, 'challenge': current_challenge})

@app.route('/api/stop-simulation', methods=['POST'])
def stop_simulation():
    recent_data = list(telemetry_buffer)
    analysis = analyze_performance(recent_data)
    return jsonify({'success': True, 'analysis': analysis})

# ===== ADVANCED FEATURE API ENDPOINTS =====

@app.route('/api/optimization-lab', methods=['GET', 'POST'])
def optimization_lab():
    """4.1 Autonomous Optimization Lab"""
    if request.method == 'POST':
        data = request.json
        recent_data = list(telemetry_buffer)[-500:]
        pid_params = optimize_pid_parameters(recent_data)
        train_drift_detector(recent_data)
        return jsonify({'success': True, 'pid_params': pid_params, 'drift_detector_trained': ml_models['drift_detector'] is not None})
    else:
        recent_data = list(telemetry_buffer)[-500:]
        return jsonify({
            'pid_params': optimize_pid_parameters(recent_data),
            'sensor_graphs': [d.get('line', {}).get('qtr', []) for d in recent_data[-50:]],
            'drift_detector_ready': ml_models['drift_detector'] is not None
        })

@app.route('/api/strategy-engine', methods=['GET', 'POST'])
def strategy_engine():
    """4.2 Main Challenge Strategy Engine"""
    global telemetry_buffer, current_challenge
    
    # Get latest telemetry if available
    latest_telemetry = None
    if telemetry_buffer and len(telemetry_buffer) > 0:
        latest_telemetry = list(telemetry_buffer)[-1]
    
    # Use telemetry data if available, otherwise use request data
    if latest_telemetry and latest_telemetry.get('mode') == 'main_challenge' and latest_telemetry.get('challenge_state'):
        challenge_state = latest_telemetry.get('challenge_state', {})
        charges_scored = challenge_state.get('charges_scored', 0)
        time_remaining = challenge_state.get('time_remaining', 150)
        golden_available = challenge_state.get('golden_charges', 0) > 0
    else:
        # Fallback to request data
        data = request.json if request.method == 'POST' and request.json else {}
        charges_scored = data.get('charges_scored', 0)
        time_remaining = data.get('time_remaining', 150)
        golden_available = data.get('golden_available', True)
    time_remaining = request.json.get('time_remaining', 150) if request.method == 'POST' else 150
    golden_available = request.json.get('golden_available', True) if request.method == 'POST' else True
    
    strategy = optimize_strategy(charges_scored, time_remaining, golden_available)
    return jsonify({'success': True, 'strategy': strategy})

@app.route('/api/ai-driver-assist', methods=['GET'])
def ai_driver_assist_endpoint():
    """4.3 AI Driver Assist"""
    recent_data = list(telemetry_buffer)[-10:]
    suggestions = ai_driver_assist(recent_data)
    return jsonify({'suggestions': suggestions})

@app.route('/api/performance-psi', methods=['GET'])
def performance_psi():
    """4.14 Performance Scoring Index"""
    recent_data = list(telemetry_buffer)[-500:]
    psi = calculate_psi(recent_data)
    return jsonify(psi)

@app.route('/api/auto-debugger', methods=['GET'])
def auto_debugger():
    """4.15 Auto-Debugger"""
    recent_data = list(telemetry_buffer)[-500:]
    issues = analyze_code_issues(recent_data)
    return jsonify({'issues': issues})

@app.route('/api/predict-completion', methods=['GET'])
def predict_completion():
    """4.12 Autonomous Time Predictor"""
    recent_data = list(telemetry_buffer)[-500:]
    challenge = request.args.get('challenge', current_challenge or 'auto')
    prediction = predict_autonomous_completion(recent_data, challenge)
    return jsonify(prediction)

@app.route('/api/match-story', methods=['GET'])
def match_story():
    """4.8 Match Story Generator"""
    recent_data = list(telemetry_buffer)[-500:]
    challenge = request.args.get('challenge', current_challenge or 'auto')
    story = generate_match_story(recent_data, challenge)
    return jsonify({'story': story})

@app.route('/api/optimal-path', methods=['GET'])
def optimal_path():
    """4.9 Perfect Autonomous Generator"""
    recent_data = list(telemetry_buffer)[-500:]
    challenge = request.args.get('challenge', current_challenge or 'auto')
    path = generate_optimal_path(recent_data, challenge)
    return jsonify(path)

@app.route('/api/failure-modes', methods=['GET', 'POST'])
def failure_modes_api():
    """4.5 Failure Mode Injection"""
    if request.method == 'POST':
        data = request.json
        global failure_modes
        for key in failure_modes:
            if key in data:
                failure_modes[key] = data[key]
        return jsonify({'success': True, 'modes': failure_modes})
    else:
        return jsonify(failure_modes)

@app.route('/api/hardware-health', methods=['GET'])
def hardware_health_api():
    """Get comprehensive hardware health status"""
    try:
        summary = get_hardware_health_summary()
        return jsonify(summary)
    except Exception as e:
        import traceback
        error_msg = str(e)
        traceback.print_exc()
        return jsonify({
            'error': error_msg,
            'overall_status': 'error',
            'health_score': 0,
            'components': {},
            'system': {'warnings': [f'Error loading health data: {error_msg}']}
        }), 500

@app.route('/api/inject-fake-health', methods=['POST'])
def inject_fake_health():
    """Inject fake health data for testing"""
    global hardware_health
    
    try:
        # Simulate various health issues
        import random
        
        # Simulate motor overload - ensure we get some critical/warning states
        left_overload = random.randint(150, 600)
        hardware_health['motors']['left_motor']['overload_count'] = left_overload
        hardware_health['motors']['left_motor']['runtime_hours'] = random.uniform(50, 120)
        hardware_health['motors']['left_motor']['total_power_cycles'] = random.randint(5000, 15000)
        hardware_health['motors']['left_motor']['last_overload'] = time.time()
        if left_overload > 500:
            hardware_health['motors']['left_motor']['status'] = 'critical'
        elif left_overload > 100:
            hardware_health['motors']['left_motor']['status'] = 'warning'
        else:
            hardware_health['motors']['left_motor']['status'] = 'healthy'
        
        right_overload = random.randint(50, 200)
        hardware_health['motors']['right_motor']['overload_count'] = right_overload
        hardware_health['motors']['right_motor']['runtime_hours'] = random.uniform(45, 110)
        hardware_health['motors']['right_motor']['total_power_cycles'] = random.randint(4000, 12000)
        hardware_health['motors']['right_motor']['last_overload'] = time.time()
        if right_overload > 500:
            hardware_health['motors']['right_motor']['status'] = 'critical'
        elif right_overload > 100:
            hardware_health['motors']['right_motor']['status'] = 'warning'
        else:
            hardware_health['motors']['right_motor']['status'] = 'healthy'
        
        # Simulate battery issues - ensure critical/warning states
        deep_discharge = random.randint(8, 15)  # Always trigger warning/critical
        hardware_health['battery']['deep_discharge_count'] = deep_discharge
        hardware_health['battery']['overheat_count'] = random.randint(0, 3)
        # Clear and add low voltage to history (deque doesn't have clear() in older Python, so we recreate it)
        hardware_health['battery']['voltage_history'] = deque(maxlen=100)
        for _ in range(10):
            hardware_health['battery']['voltage_history'].append(random.randint(1800, 2200))
        if deep_discharge > 10:
            hardware_health['battery']['status'] = 'critical'
        elif deep_discharge > 5:
            hardware_health['battery']['status'] = 'warning'
        else:
            hardware_health['battery']['status'] = 'healthy'
        
        # Simulate servo wear - ensure some warnings
        gripper_cycles = random.randint(8000, 15000)
        gripper_stalls = random.randint(40, 60)  # Always trigger warning/critical
        hardware_health['servos']['gripper']['cycles'] = gripper_cycles
        hardware_health['servos']['gripper']['stall_count'] = gripper_stalls
        if gripper_stalls > 50:
            hardware_health['servos']['gripper']['status'] = 'critical'
        elif gripper_cycles > 10000:
            hardware_health['servos']['gripper']['status'] = 'warning'
        else:
            hardware_health['servos']['gripper']['status'] = 'healthy'
        
        arm_cycles = random.randint(8000, 15000)  # Ensure warning
        hardware_health['servos']['arm']['cycles'] = arm_cycles
        hardware_health['servos']['arm']['stall_count'] = random.randint(0, 30)
        if hardware_health['servos']['arm']['stall_count'] > 50:
            hardware_health['servos']['arm']['status'] = 'critical'
        elif arm_cycles > 10000:
            hardware_health['servos']['arm']['status'] = 'warning'
        else:
            hardware_health['servos']['arm']['status'] = 'healthy'
        
        # Simulate sensor issues - ensure warnings
        line_drift = random.randint(55, 80)  # Always trigger warning
        hardware_health['sensors']['line_sensors']['calibration_drift'] = line_drift
        if line_drift > 50:
            hardware_health['sensors']['line_sensors']['status'] = 'warning'
        else:
            hardware_health['sensors']['line_sensors']['status'] = 'healthy'
        
        hardware_health['sensors']['imu']['drift_detected'] = True  # Always trigger warning
        hardware_health['sensors']['imu']['status'] = 'warning'
        
        tof_errors = random.randint(25, 40)  # Always trigger warning
        hardware_health['sensors']['tof']['error_count'] = tof_errors
        if tof_errors > 20:
            hardware_health['sensors']['tof']['status'] = 'warning'
        else:
            hardware_health['sensors']['tof']['status'] = 'healthy'
        
        # Update system runtime
        hardware_health['system']['total_runtime_hours'] = random.uniform(80, 180)
        hardware_health['system']['last_maintenance'] = time.time() - (random.randint(35, 60) * 86400)  # 35-60 days ago
        
        # Generate warnings manually since we're injecting fake data
        warnings = []
        
        # Motor warnings
        for motor_name, motor_data in hardware_health['motors'].items():
            if motor_data['status'] == 'critical':
                warnings.append(f"⚠️ {motor_name.replace('_', ' ').title()}: CRITICAL - Excessive overload detected! Reduce power immediately.")
            elif motor_data['status'] == 'warning':
                warnings.append(f"⚠️ {motor_name.replace('_', ' ').title()}: High overload count ({motor_data['overload_count']}). Consider reducing power.")
            
            if motor_data['runtime_hours'] > 100:
                warnings.append(f"ℹ️ {motor_name.replace('_', ' ').title()}: {motor_data['runtime_hours']:.1f} hours runtime. Consider maintenance check.")
        
        # Battery warnings
        if hardware_health['battery']['status'] == 'critical':
            warnings.append("🔴 Battery: CRITICAL - Deep discharge detected! Charge immediately to prevent damage.")
        elif hardware_health['battery']['status'] == 'warning':
            warnings.append("🟡 Battery: Low voltage detected. Charge soon.")
        
        if hardware_health['battery']['deep_discharge_count'] > 10:
            warnings.append(f"⚠️ Battery: {hardware_health['battery']['deep_discharge_count']} deep discharges detected. Battery health degrading.")
        
        # Servo warnings
        for servo_name, servo_data in hardware_health['servos'].items():
            if servo_data['cycles'] > 10000:
                warnings.append(f"ℹ️ {servo_name.title()} Servo: {servo_data['cycles']} cycles. Consider lubrication check.")
            if servo_data['stall_count'] > 50:
                warnings.append(f"⚠️ {servo_name.title()} Servo: {servo_data['stall_count']} stalls detected. Check for obstructions.")
        
        # Sensor warnings
        if hardware_health['sensors']['line_sensors']['status'] == 'warning':
            warnings.append("🟡 Line Sensors: Calibration drift detected. Recalibrate sensors.")
        if hardware_health['sensors']['imu']['status'] == 'warning':
            warnings.append("🟡 IMU: Drift detected. Check sensor mounting and recalibrate.")
        if hardware_health['sensors']['tof']['status'] == 'warning':
            warnings.append("🟡 TOF Sensor: High error rate. Check sensor connection and cleanliness.")
        
        # System warnings
        runtime_hours = hardware_health['system']['total_runtime_hours']
        if runtime_hours > 200:
            days_since_maintenance = (time.time() - hardware_health['system']['last_maintenance']) / 86400
            if days_since_maintenance > 30:
                warnings.append(f"ℹ️ System: {days_since_maintenance:.0f} days since last maintenance. Schedule routine check.")
        
        hardware_health['system']['warnings'] = warnings
        
        # Get summary to return - ensure all deques are converted to lists
        summary = get_hardware_health_summary()
        
        # Double-check: Convert any remaining deques in the summary (defensive programming)
        def convert_deques_to_lists(obj):
            """Recursively convert all deques to lists in a nested structure"""
            if isinstance(obj, deque):
                return list(obj)
            elif isinstance(obj, dict):
                return {k: convert_deques_to_lists(v) for k, v in obj.items()}
            elif isinstance(obj, (list, tuple)):
                return [convert_deques_to_lists(item) for item in obj]
            else:
                return obj
        
        # Ensure no deques remain
        summary_clean = convert_deques_to_lists(summary)
        
        return jsonify({
            'success': True,
            'message': 'Fake health data injected successfully. Check warnings and component statuses.',
            'data': summary_clean
        })
    except Exception as e:
        import traceback
        error_msg = str(e)
        traceback.print_exc()
        return jsonify({
            'success': False,
            'error': error_msg,
            'traceback': traceback.format_exc()
        }), 500

@app.route('/api/generate-fake-driving', methods=['POST'])
def generate_fake_driving():
    """Generate and inject fake driving data for testing"""
    global telemetry_buffer
    
    data = request.json or {}
    duration = data.get('duration', 30)  # seconds
    skill_level = data.get('skill', 'intermediate')  # beginner, intermediate, advanced
    
    # Generate fake data
    fake_data = generate_fake_driving_data(duration_seconds=duration, driver_skill=skill_level)
    
    # Add to telemetry buffer
    for packet in fake_data:
        telemetry_buffer.append(packet)
        # Emit to connected clients
        socketio.emit('telemetry', packet)
    
    return jsonify({
        'success': True,
        'packets_generated': len(fake_data),
        'duration': duration,
        'skill_level': skill_level,
        'message': f'Generated {len(fake_data)} fake driving packets ({duration}s, {skill_level} skill)'
    })

@app.route('/api/driver-analysis', methods=['GET'])
def driver_analysis():
    """Driver performance analysis"""
    manual_data = [d for d in telemetry_buffer if d.get('mode') == 'manual']
    if not manual_data:
        return jsonify({'avg_speed': 0, 'smoothness': 0, 'recommendations': []})
    
    speeds = [abs(d.get('cmd', {}).get('left_pwm', 0)) + abs(d.get('cmd', {}).get('right_pwm', 0)) for d in manual_data[-200:]]
    avg_speed = np.mean(speeds) if speeds else 0
    
    if len(speeds) > 1:
        accelerations = np.diff(speeds)
        smoothness = 1.0 / (1.0 + np.var(accelerations))
    else:
        smoothness = 0.5
    
    recommendations = []
    if smoothness < 0.3:
        recommendations.append("Driver input is jerky - practice smoother stick movements")
    if avg_speed > 200:
        recommendations.append("High speed detected - consider slowing for better precision")
    
    return jsonify({
        'avg_speed': avg_speed,
        'smoothness': smoothness,
        'recommendations': recommendations
    })

# ===== SOCKET.IO =====
@socketio.on('connect')
def handle_connect():
    emit('status', {'connected': True, 'challenge': current_challenge})

@socketio.on('disconnect')
def handle_disconnect():
    pass

# ===== MAIN =====
if __name__ == '__main__':
    import socket
    
    print("NRL Robot Development Server")
    print("=" * 50)
    
    # Use PORT from environment (for deployment) or find free port (for local dev)
    port = PORT
    if port == 5001:  # Default, try to find free port for local dev
        def find_free_port(start_port=5001):
            for port in range(start_port, start_port + 10):
                try:
                    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
                        s.bind(('', port))
                        return port
                except OSError:
                    continue
            return None
        
        found_port = find_free_port(5001)
        if found_port:
            port = found_port
        elif not found_port:
            print("❌ ERROR: Could not find an available port (tried 5001-5010)")
            sys.exit(1)
    
    print(f"Server: http://localhost:{port}")
    print(f"Mode: {'Simulation' if SIMULATION_MODE else 'Hardware'}")
    print("=" * 50)
    
    # Initialize mock simulator in simulation mode
    if SIMULATION_MODE:
        if not mock_simulator:
            mock_simulator = MockRobotSimulator()
        print("✓ Simulation mode ready")
        print("💡 Click 'Main Challenge' or 'Auto Challenge' to start")
    else:
        if connect_serial():
            print("✓ Hardware mode ready")
    
    try:
        print(f"\n🚀 Starting server on port {port}...")
        print(f"📊 Dashboard: http://localhost:{port}")
        if os.getenv("RAILWAY_ENVIRONMENT") or os.getenv("RENDER"):
            print("🌐 Running in cloud deployment mode")
        print("Press Ctrl+C to stop\n")
        socketio.run(app, host=HOST, port=port, debug=DEBUG_MODE, allow_unsafe_werkzeug=True)
    except OSError as e:
        if "Address already in use" in str(e):
            print(f"\n❌ ERROR: Port {port} is already in use!")
            print(f"💡 Try: lsof -ti:{port} | xargs kill -9")
            print(f"💡 Or restart your computer")
        else:
            print(f"\n❌ ERROR starting server: {e}")
        sys.exit(1)
    except KeyboardInterrupt:
        print("\n\n✓ Server stopped by user")
    except Exception as e:
        print(f"\n❌ ERROR: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

