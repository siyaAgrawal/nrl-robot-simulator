#!/usr/bin/env python3
"""
Mock Robot Simulator
Generates realistic telemetry data for testing the dev server without hardware
"""

import time
import json
import random
import math
from collections import deque

class MockRobotSimulator:
    def __init__(self):
        self.mode = "manual"
        self.time = 0
        self.line_position = 0.0  # -1.0 to 1.0
        self.speed = 0
        self.turn = 0
        self.battery = 3500  # Raw ADC value
        self.tof_distance = -1
        self.state = "idle"
        self.qtr_values = [0] * 8
        
        # Simulation parameters
        self.line_following = False
        self.pickup_sequence = False
        self.lap_count = 0
        
    def generate_telemetry(self):
        """Generate realistic telemetry packet"""
        self.time += 0.05  # 50ms intervals
        
        # Simulate mode switching
        if random.random() < 0.01:  # 1% chance to switch
            self.mode = "autonomous" if self.mode == "manual" else "manual"
        
        # Simulate line following behavior
        if self.mode == "autonomous":
            self.simulate_autonomous()
        
        else:
            self.simulate_manual()
        
        # Generate QTR sensor values based on line position
        self.generate_qtr_values()
        
        # Generate telemetry packet
        packet = {
            "mode": self.mode,
            "cmd": {
                "left_pwm": int(self.speed + self.turn),
                "right_pwm": int(self.speed - self.turn),
                "servo_grabber": 90 if not self.pickup_sequence else 95,
                "servo_arm": 90 if not self.pickup_sequence else 160
            },
            "battery": {
                "raw": self.battery
            },
            "line": {
                "error": int(self.line_position * 3500),
                "qtr": self.qtr_values.copy()
            },
            "distance": {
                "tof_front": self.tof_distance
            },
            "encoders": {
                "left": int(self.time * 100),  # Simulated encoder counts
                "right": int(self.time * 98)   # Slight difference for realism
            }
        }
        
        return packet
    
    def simulate_autonomous(self):
        """Simulate autonomous mode behavior"""
        # Simulate line following with some error
        if not self.pickup_sequence:
            # Normal line following
            self.line_position += random.uniform(-0.1, 0.1)
            self.line_position = max(-1.0, min(1.0, self.line_position))
            
            # PID-like correction
            correction = -self.line_position * 50
            self.speed = 150
            self.turn = correction
            
            # Occasionally detect a spur (strong left line)
            if random.random() < 0.005:  # 0.5% chance per update
                self.pickup_sequence = True
                self.state = "approaching_pickup"
        else:
            # Pickup sequence
            if self.state == "approaching_pickup":
                self.speed = 80
                self.turn = 0
                self.tof_distance = max(50, self.tof_distance - 10)
                if self.tof_distance < 80:
                    self.state = "picking_up"
                    self.tof_distance = 80
            elif self.state == "picking_up":
                self.speed = 0
                self.turn = 0
                if random.random() < 0.1:  # 10% chance to complete pickup
                    self.state = "exiting_spur"
                    self.pickup_sequence = False
                    self.tof_distance = -1
            elif self.state == "exiting_spur":
                self.speed = -100
                self.turn = 0
                if random.random() < 0.05:
                    self.state = "line_following"
                    self.pickup_sequence = False
            else:
                # Fallback to line following
                self.state = "line_following"
                self.speed = 150
                self.turn = -self.line_position * 50
    
    def simulate_manual(self):
        """Simulate manual mode (PS5 controller)"""
        # Simulate human-like input with some variation
        if random.random() < 0.3:  # 30% chance to change input
            self.speed = random.randint(-200, 200)
            self.turn = random.randint(-100, 100)
            #
        else:
            # Gradual changes (more realistic)
            self.speed += random.randint(-20, 20)
            self.turn += random.randint(-10, 10)
            self.speed = max(-255, min(255, self.speed))
            self.turn = max(-255, min(255, self.turn))
        
        # Line position follows movement
        self.line_position += (self.turn / 1000.0) + random.uniform(-0.05, 0.05)
        self.line_position = max(-1.0, min(1.0, self.line_position))
        
        # Random TOF readings
        if random.random() < 0.1:
            self.tof_distance = random.randint(100, 500)
        else:
            self.tof_distance = -1
    
    def generate_qtr_values(self):
        """Generate QTR sensor values based on line position"""
        # Line position: -1.0 (far left) to 1.0 (far right)
        # Center sensors are 3 and 4 (0-indexed)
        
        line_sensor_index = 3.5 + (self.line_position * 3.5)
        
        for i in range(8):
            # Distance from line center
            distance = abs(i - line_sensor_index)
            
            # Sensor reading (higher = more line detected)
            if distance < 0.5:
                # Directly on line
                base_value = 800 + random.randint(-50, 50)
            elif distance < 1.0:
                # Near line
                base_value = 400 + random.randint(-50, 50)
            elif distance < 2.0:
                # Somewhat near
                base_value = 100 + random.randint(-30, 30)
            else:
                # Far from line (white surface)
                base_value = 50 + random.randint(-20, 20)
            
            self.qtr_values[i] = max(0, min(1023, base_value))
    
    def get_json_line(self):
        """Get telemetry as JSON string (like serial output)"""
        packet = self.generate_telemetry()
        return json.dumps(packet) + "\n"

if __name__ == "__main__":
    # Test the simulator
    simulator = MockRobotSimulator()
    print("Mock Robot Simulator - Test Output")
    print("=" * 50)
    
    for i in range(10):
        packet = simulator.generate_telemetry()
        print(f"\nPacket {i+1}:")
        print(json.dumps(packet, indent=2))
        time.sleep(0.1)

