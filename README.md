# NRL Robot System - Complete Guide

## Live dashboard

https://robot-008.vercel.app runs the full dashboard with no server. `public/browser-backend.js` loads `server.py` into the visitor's browser with Pyodide (numpy and scikit-learn included) and routes every `/api/...` call and the telemetry stream to it, in simulation mode. To drive the real robot over serial, run `python3 server.py` locally as before.


**Simple, efficient, all-in-one robotics control system for NRL Battle of Charges**

## 📁 Files

### Main Files (Only 3 files needed!)
- **`robot.ino`** - Complete ESP32 firmware (upload this to your robot)
- **`server.py`** - Development server with dashboard (run this on your computer)
- **`templates/dashboard.html`** - Web dashboard interface

### Supporting Files
- **`sensor_calibration.ino`** - Calibrate your sensors
- **`mock_robot_simulator.py`** - Simulation mode (no hardware needed)
- **`requirements.txt`** - Python dependencies

## 🚀 Quick Start

### 1. Upload Firmware
```
1. Open robot.ino in Arduino IDE
2. Select ESP32 board
3. Upload to device
```

### 2. Start Server
```bash
pip install -r requirements.txt
python server.py
```

### 3. Open Dashboard
```
http://localhost:5001
```

## 🎮 Two Challenges Supported

### Auto Challenge (Autonomous Skill)
- **Field**: 8ft × 8ft square track with 50mm black line
- **Duration**: 120 seconds max
- **Scoring**: 155 points max
  - 5 pts per corner (60 max)
  - 15 pts pickup
  - 15 pts dropoff
  - Lap bonuses: 10, 5, 5

### Main Challenge (Battle of Charges)
- **Field**: 12ft × 12ft
- **Duration**: 2:30 (150 seconds)
- **Objective**: Score CHARGES in Drop Zone, park in Charge Station
- **Features**: Supercharge Mode, Gold Rush period

## 🎯 Control Modes

### Manual Mode (PS5 Controller)
- **Left Stick**: Forward/backward
- **Right Stick**: Turn
- **Triangle**: Arm up
- **Cross**: Arm down
- **Square**: Close gripper
- **Circle**: Open gripper
- **Options**: Start Auto Challenge

### Autonomous Modes
- **Auto Challenge**: Fully autonomous line following
- **Main Challenge**: Autonomous navigation and scoring

## 📡 Communication

### ESP32 → Server
Sends JSON telemetry every 50ms:
```json
{
  "mode": "auto_challenge",
  "cmd": {"left_pwm": 150, "right_pwm": 150},
  "line": {"error": 0, "qtr": [0,1,1,1,1,0,0,0]},
  "distance": {"tof_front": 30},
  "encoders": {"left": 100, "right": 98}
}
```

### Server → ESP32
Commands:
- `start_autonomous` - Start Auto Challenge
- `start_main_challenge` - Start Main Challenge
- `emergency_stop` - Stop all movement

## 🔧 Configuration

### In `robot.ino`:
```cpp
#define PS5_MAC_ADDRESS "10:18:49:4D:07:E1"  // Your controller MAC
const int QTR_PINS[8] = {2, 4, 5, 18, 19, 21, 22, 23};  // Your pins
```

### In `server.py`:
```python
SERIAL_PORT = "COM3"  # Your port (Windows)
# SERIAL_PORT = "/dev/ttyUSB0"  # Linux
SIMULATION_MODE = True  # Set False for real hardware
```

## 📊 Dashboard Features

- **Real-time telemetry** - Live sensor and motor data
- **Performance analysis** - Automatic recommendations
- **Chatbot** - Ask questions about robot performance
- **Simulation mode** - Test without hardware
- **Challenge selection** - Switch between Auto and Main challenges

## 🎓 Tips

1. **Calibrate sensors first** - Run `sensor_calibration.ino`
2. **Tune PID parameters** - Adjust in `robot.ino` line 38
3. **Test in simulation** - Use simulation mode before field testing
4. **Monitor dashboard** - Watch real-time performance
5. **Ask chatbot** - Get insights and recommendations

## 📝 Pin Configuration

Update these in `robot.ino` to match your wiring:
- Motor pins: LEFT_PWM, LEFT_DIR, RIGHT_PWM, RIGHT_DIR
- Servo pins: ARM_PIN, GRIPPER_PIN
- QTR sensors: QTR_PINS[8]
- Encoders: LEFT_ENC_A/B, RIGHT_ENC_A/B

## 🐛 Troubleshooting

**Robot not responding?**
- Check PS5 controller connection
- Verify pin numbers match your wiring
- Check Serial Monitor for errors

**Server not connecting?**
- Verify serial port name
- Check if robot is powered on
- Try simulation mode first

**Dashboard not updating?**
- Check browser console (F12)
- Verify WebSocket connection
- Refresh the page

## 📍 Sensor Placement

### QTR Line Sensors (8 sensors)
- **Location**: Front underside, 2-5mm above ground
- **Layout**: Linear array, evenly spaced (~80-120mm total width)
- **Calibration**: Run `sensor_calibration.ino` first

### TOF Distance Sensor
- **Location**: Front-center, 100-150mm height, pointing forward
- **Purpose**: CHARGE detection and approach

### Encoders (Optional)
- **Location**: On motor shafts
- **Purpose**: Accurate position tracking

## 🏆 Competition Details

### Auto Challenge Rules
- 8ft × 8ft square track with 50mm black line
- 3 clockwise laps required
- Pick up CHARGE in Pick-Up Spur
- Drop CHARGE in Drop-Off Spur
- 120 second time limit
- Max score: 155 points

### Main Challenge Rules
- 12ft × 12ft field
- 2:30 match duration
- Score CHARGES in Drop Zone
- Supercharge Mode after 8 CHARGES
- Gold Rush starts at 2:00
- Charge Station parking for bonus points

## 📚 Code Structure

All code is well-commented and easy to understand:
- **robot.ino** - Single file with all robot logic (PID, line following, challenges)
- **server.py** - Complete server with simulation, scoring, chatbot
- **Simple** - Easy to read and modify
- **Efficient** - Optimized performance
- **Complete** - Everything you need

Good luck with your competition! 🤖🏆
