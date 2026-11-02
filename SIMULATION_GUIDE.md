# 🎮 Simulation Guide

## Overview

The system now includes **two separate 3D simulations**:

1. **Autonomous Challenge Simulation** - 3-lap line following with random sensor data
2. **Main Challenge Simulation** - PS5 controller-controlled robot on 12x12 ft field

Both simulations work on localhost and are fully compatible with real robot hardware.

## 🚀 How to Use

### Starting Simulations

1. **Start the server:**
   ```bash
   npm run dev
   # or
   python server.py
   ```

2. **Open dashboard:** http://localhost:5001

3. **Go to Simulation tab**

4. **Choose a challenge:**
   - Click **"▶ Start Auto Challenge"** for autonomous simulation
   - Click **"▶ Start Main Challenge"** for PS5-controlled simulation

### Autonomous Challenge Simulation

**Features:**
- 3D visualization of 8x8 ft square track
- Robot follows black line with random sensor noise
- Automatic pickup/dropoff detection
- 120-second time limit
- Real-time predictions and strategy

**What you'll see:**
- Robot moving around the track
- Corner count
- Pickup/dropoff status
- Time remaining
- Completion predictions

**How it works:**
- Sensors generate random data based on line position
- Robot uses PID-like control to follow line
- Automatically detects corners, pickup zones, dropoff zones
- Stops after 120 seconds or if line is lost for 10 seconds

### Main Challenge Simulation

**Features:**
- 3D visualization of 12x12 ft field
- PS5 controller interface (on-screen)
- Source Zone, Drop Zone, Charge Station
- Real-time strategy recommendations
- Charge pickup/dropoff mechanics

**Controls:**
- **Left Stick:** Move robot forward/backward
- **Right Stick:** Turn robot left/right
- **△ Button:** Arm up
- **✕ Button:** Arm down
- **□ Button:** Close gripper
- **○ Button:** Open gripper

**What you'll see:**
- Robot position on field
- CHARGES scored count
- Charge Station status (engage/dock/full_park)
- Time remaining
- Strategy recommendations

**How it works:**
- Click and drag sticks to control robot
- Click buttons for arm/gripper control
- Robot automatically detects zones
- Strategy engine provides real-time recommendations

## 🔌 Real Robot Integration

### For Real Hardware:

1. **Set SIMULATION_MODE = False** in `server.py`

2. **Connect ESP32** via USB to your computer

3. **Update SERIAL_PORT** in `server.py`:
   - Windows: `"COM3"` or `"COM5"`
   - Mac: `"/dev/tty.usbserial-xxxxx"`
   - Linux: `"/dev/ttyUSB0"` or `"/dev/ttyACM0"`

4. **Upload robot.ino** to ESP32

5. **Start server** - it will automatically connect to ESP32

### Telemetry Format

The real robot sends JSON telemetry every 50ms:

```json
{
  "mode": "auto_challenge" | "main_challenge" | "manual",
  "cmd": {
    "left_pwm": -255 to 255,
    "right_pwm": -255 to 255,
    "servo_grabber": 0 to 180,
    "servo_arm": 0 to 180
  },
  "battery": {"raw": 0 to 4095},
  "line": {
    "error": -3500 to 3500,
    "qtr": [0-1023, ...] (8 values)
  },
  "distance": {"tof_front": -1 or mm},
  "encoders": {
    "left": count,
    "right": count
  }
}
```

### Real Robot Features

All dashboard features work with real robot:
- ✅ Real-time telemetry graphs
- ✅ Performance analysis
- ✅ AI chatbot
- ✅ Advanced tools (PSI, strategy, etc.)
- ✅ Challenge mode switching

**Note:** Position data in 3D simulation requires odometry calculation from encoders. The simulation will show robot movement based on motor commands if position isn't provided.

## 📊 Dashboard Features

### Telemetry Tab
- Real-time metrics
- Performance graphs
- Driver analysis (for manual mode)

### Advanced Tools Tab
- All competition tools
- Optimization Lab
- Strategy Engine
- PSI scoring
- Auto-Debugger
- And more...

### Simulation Tab
- 3D visualizations
- Challenge controls
- PS5 controller (Main Challenge)
- Predictions and strategy

### AI Assistant Tab
- ML-powered chatbot
- Performance questions
- Strategy recommendations

## 🎯 Tips

1. **For testing:** Use simulation mode first to test all features
2. **For competition:** Switch to real hardware mode
3. **Strategy:** Use Strategy Engine during Main Challenge for optimal paths
4. **Performance:** Check PSI score after each run
5. **Debugging:** Use Auto-Debugger to find code issues

## 🔧 Troubleshooting

**Simulation not starting:**
- Check browser console for errors
- Make sure server is running
- Try refreshing the page

**PS5 controller not working:**
- Make sure you're in Main Challenge simulation
- Click and drag sticks (don't just click)
- Check browser console for errors

**Real robot not connecting:**
- Check SERIAL_PORT in server.py
- Make sure ESP32 is connected
- Check Arduino Serial Monitor for telemetry
- Verify baud rate is 115200

---

**Ready to compete!** 🏆




