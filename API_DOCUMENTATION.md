# API Documentation - Complete System APIs

## Overview

This system uses **internal REST APIs** (Flask routes) and **WebSocket communication** (Socket.IO) for real-time data exchange. **No external web service APIs** are used - everything is self-contained and runs on localhost.

---

## 🔌 **Internal REST API Endpoints**

All endpoints are served by Flask on `http://localhost:5001`

### **Core Endpoints**

#### `GET /`
- **Purpose:** Main dashboard page
- **Response:** HTML (renders `dashboard.html`)
- **Usage:** Initial page load

#### `GET /api/telemetry`
- **Purpose:** Get recent telemetry data
- **Response:** JSON array of telemetry objects (last 100 entries)
- **Example Response:**
```json
[
  {
    "mode": "main_challenge",
    "cmd": {"left_pwm": 150, "right_pwm": 150},
    "battery": {"raw": 3500},
    "line": {"error": 0, "qtr": [0,0,0,0,0,0,0,0]},
    "distance": {"tof_front": 200},
    "encoders": {"left": 1000, "right": 1000}
  }
]
```

#### `GET /api/analysis`
- **Purpose:** Get performance analysis of recent telemetry
- **Response:** JSON with metrics and recommendations
- **Example Response:**
```json
{
  "avg_line_error": 45.2,
  "avg_speed": 150.5,
  "speed_variance": 1200.3,
  "recommendations": ["Reduce speed variance", "Improve line following"]
}
```

#### `POST /api/chatbot`
- **Purpose:** Send query to AI chatbot
- **Request Body:**
```json
{
  "query": "How am I doing?"
}
```
- **Response:**
```json
{
  "response": "Your PSI score is 75/100. Good performance..."
}
```

---

### **Challenge Control Endpoints**

#### `POST /api/start-auto-challenge`
- **Purpose:** Start Auto Challenge simulation
- **Response:**
```json
{
  "success": true,
  "challenge": "auto"
}
```

#### `POST /api/start-main-challenge`
- **Purpose:** Start Main Challenge simulation
- **Response:**
```json
{
  "success": true,
  "challenge": "main"
}
```

#### `POST /api/start-simulation`
- **Purpose:** Start simulation (uses current challenge mode)
- **Response:**
```json
{
  "success": true,
  "run_id": 1,
  "challenge": "auto" | "main"
}
```

#### `POST /api/stop-simulation`
- **Purpose:** Stop current simulation and get analysis
- **Response:**
```json
{
  "success": true,
  "analysis": { ... }
}
```

---

### **Input Control Endpoints**

#### `POST /api/ps5-input`
- **Purpose:** Send PS5 controller input for Main Challenge
- **Request Body:**
```json
{
  "left_stick_y": 0.5,
  "right_stick_x": 0.3,
  "triangle": false,
  "cross": false,
  "square": false,
  "circle": false
}
```
- **Response:**
```json
{
  "success": true
}
```

#### `POST /api/keyboard-input`
- **Purpose:** Send WASD keyboard input for Main Challenge
- **Request Body:**
```json
{
  "w": true,
  "a": false,
  "s": false,
  "d": false,
  "q": false,
  "e": false,
  "z": false,
  "x": false
}
```
- **Response:**
```json
{
  "success": true
}
```

---

### **Advanced Tools API Endpoints**

#### `GET /api/optimization-lab`
- **Purpose:** Get optimization lab data (PID params, sensor graphs)
- **Response:**
```json
{
  "pid_params": {"kp": 0.5, "ki": 0.01, "kd": 0.1},
  "sensor_graphs": [[...], [...]],
  "drift_detector_ready": true
}
```

#### `POST /api/optimization-lab`
- **Purpose:** Run optimization (train models, tune PID)
- **Response:**
```json
{
  "success": true,
  "pid_params": {...},
  "drift_detector_trained": true
}
```

#### `GET /api/strategy-engine`
- **Purpose:** Get current strategy recommendations
- **Response:**
```json
{
  "success": true,
  "strategy": {
    "name": "Collect 8 CHARGES",
    "priority": "High",
    "route": ["Source Zone", "Drop Zone", ...],
    "expected_score": 16,
    "risk": "Low"
  }
}
```

#### `POST /api/strategy-engine`
- **Purpose:** Get strategy with custom parameters
- **Request Body:**
```json
{
  "charges_scored": 4,
  "time_remaining": 90,
  "golden_available": true
}
```

#### `GET /api/ai-driver-assist`
- **Purpose:** Get real-time driver assistance suggestions
- **Response:**
```json
{
  "suggestions": [
    "Collision warning: TOF sensor detected obstacle at 50mm",
    "Reduce speed for better precision"
  ]
}
```

#### `GET /api/performance-psi`
- **Purpose:** Get Performance Scoring Index (0-100)
- **Response:**
```json
{
  "overall_psi": 75.5,
  "smoothness": 80.0,
  "precision": 70.0,
  "speed": 75.0,
  "stability": 77.0,
  "recommendations": [...]
}
```

#### `GET /api/auto-debugger`
- **Purpose:** Get code issue analysis
- **Response:**
```json
{
  "issues": [
    {
      "type": "blocking_delay",
      "severity": "high",
      "description": "Detected 100ms delay in main loop",
      "fix": "Use non-blocking delays"
    }
  ]
}
```

#### `GET /api/predict-completion`
- **Purpose:** Get autonomous completion prediction
- **Query Parameters:** `?challenge=auto` or `?challenge=main`
- **Response:**
```json
{
  "completion_probability": 0.85,
  "expected_score": 120,
  "risk_level": "Low",
  "time_remaining": 45.2,
  "confidence": 0.9
}
```

#### `GET /api/match-story`
- **Purpose:** Get AI-generated match analysis story
- **Query Parameters:** `?challenge=auto` or `?challenge=main`
- **Response:**
```json
{
  "story": "Your robot started strong with excellent line following..."
}
```

#### `GET /api/optimal-path`
- **Purpose:** Get optimal path recommendations
- **Query Parameters:** `?challenge=auto` or `?challenge=main`
- **Response:**
```json
{
  "path": [
    {"x": 0, "y": 0, "action": "start"},
    {"x": 2, "y": 0, "action": "pickup"},
    ...
  ],
  "expected_score": 155,
  "time_estimate": 95.5
}
```

#### `GET /api/failure-modes`
- **Purpose:** Get current failure mode injection settings
- **Response:**
```json
{
  "motor_stall": false,
  "imu_drift": false,
  "extra_friction": false,
  "battery_sag": false,
  "sensor_noise": false,
  "weight_imbalance": false
}
```

#### `POST /api/failure-modes`
- **Purpose:** Enable/disable failure mode injection
- **Request Body:**
```json
{
  "motor_stall": true,
  "sensor_noise": true
}
```

#### `GET /api/driver-analysis`
- **Purpose:** Get driver performance analysis (manual mode)
- **Response:**
```json
{
  "avg_speed": 150.5,
  "smoothness": 0.75,
  "recommendations": [
    "Practice smoother stick movements",
    "Reduce speed for better precision"
  ]
}
```

---

## 🔄 **WebSocket/Socket.IO Communication**

### **Connection**
- **URL:** `ws://localhost:5001/socket.io/`
- **Library:** Socket.IO v4.5.4 (via CDN)
- **Transport:** WebSocket with polling fallback

### **Client → Server Events**

#### `connect`
- **Purpose:** Client connects to server
- **Auto-triggered:** On page load

#### `disconnect`
- **Purpose:** Client disconnects from server
- **Auto-triggered:** On page close/navigation

### **Server → Client Events**

#### `status`
- **Purpose:** Send connection status and current challenge
- **Data:**
```json
{
  "connected": true,
  "challenge": "auto" | "main" | null
}
```

#### `telemetry` (Broadcast)
- **Purpose:** Real-time telemetry updates (20 Hz)
- **Data:** Same format as `/api/telemetry` response
- **Frequency:** ~50ms intervals

---

## 📦 **External Libraries (CDN)**

These are **JavaScript libraries** loaded from CDN, not APIs:

### **Socket.IO Client**
- **URL:** `https://cdn.socket.io/4.5.4/socket.io.min.js`
- **Purpose:** WebSocket client library
- **Usage:** Real-time bidirectional communication

### **Chart.js**
- **URL:** `https://cdn.jsdelivr.net/npm/chart.js`
- **Purpose:** Data visualization library
- **Usage:** Real-time graphs (line error, motor speed)

### **Three.js**
- **URL:** `https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js`
- **Purpose:** 3D graphics library
- **Usage:** 3D simulations (Auto Challenge, Main Challenge)

---

## 🔧 **Python Libraries (Not APIs)**

These are **local Python libraries** used for processing:

- **Flask** - Web server framework
- **Flask-SocketIO** - WebSocket support
- **pyserial** - Serial communication with ESP32
- **numpy** - Numerical computations
- **scikit-learn** - Machine learning (Random Forest models)
- **pickle** - Model serialization

---

## 📡 **Hardware Communication**

### **Serial Communication (ESP32)**
- **Protocol:** Serial/UART
- **Baud Rate:** 115200
- **Format:** JSON strings (newline-delimited)
- **Direction:** Bidirectional
  - **ESP32 → Server:** Telemetry JSON
  - **Server → ESP32:** Commands (e.g., `start_autonomous\n`)

### **Telemetry Format (JSON)**
```json
{
  "mode": "main_challenge" | "auto_challenge" | "manual",
  "position": {"x": 0.0, "y": 0.0, "theta": 0.0},
  "cmd": {
    "left_pwm": -255 to 255,
    "right_pwm": -255 to 255,
    "servo_grabber": 0-180,
    "servo_arm": 0-180
  },
  "battery": {"raw": 0-4095},
  "line": {
    "error": -3500 to 3500,
    "qtr": [0-1023, ...] (8 values)
  },
  "distance": {"tof_front": mm},
  "encoders": {
    "left": count,
    "right": count
  },
  "challenge_state": {...}
}
```

---

## 🌐 **No External Web Service APIs**

**Important:** This system does **NOT** use any external web service APIs such as:
- ❌ No cloud APIs (AWS, Google Cloud, Azure)
- ❌ No third-party ML services (OpenAI, TensorFlow Serving)
- ❌ No database services (MongoDB Atlas, Firebase)
- ❌ No authentication services (Auth0, Firebase Auth)
- ❌ No external data sources

**Everything runs locally:**
- ✅ All processing on localhost
- ✅ SQLite database (local file)
- ✅ ML models trained and run locally
- ✅ All data stays on your machine

---

## 📊 **API Usage Summary**

### **Total Endpoints:** 20 REST API endpoints
- 4 Core endpoints
- 4 Challenge control endpoints
- 2 Input control endpoints
- 10 Advanced tools endpoints

### **WebSocket Events:** 2 events (connect, disconnect)
- Plus continuous telemetry broadcasting

### **External Dependencies:** 0 web service APIs
- Only CDN libraries (Socket.IO, Chart.js, Three.js)

### **Communication Protocols:**
1. **HTTP/REST** - Request/response API calls
2. **WebSocket** - Real-time bidirectional communication
3. **Serial/UART** - Hardware communication (ESP32)

---

## 🚀 **Quick Reference**

### **Most Used Endpoints:**
1. `GET /api/telemetry` - Get live data
2. `GET /api/analysis` - Performance metrics
3. `POST /api/chatbot` - Ask questions
4. `POST /api/start-main-challenge` - Start Main Challenge
5. `POST /api/start-auto-challenge` - Start Auto Challenge
6. `POST /api/keyboard-input` - Control robot (WASD)
7. `POST /api/ps5-input` - Control robot (PS5)

### **Testing APIs:**
```bash
# Get telemetry
curl http://localhost:5001/api/telemetry

# Start Main Challenge
curl -X POST http://localhost:5001/api/start-main-challenge

# Ask chatbot
curl -X POST http://localhost:5001/api/chatbot \
  -H "Content-Type: application/json" \
  -d '{"query": "How am I doing?"}'

# Get PSI score
curl http://localhost:5001/api/performance-psi
```

---

## 📝 **Notes**

- All endpoints return JSON (except `GET /` which returns HTML)
- All POST endpoints require `Content-Type: application/json` header
- WebSocket connection is automatically established on page load
- Telemetry is broadcast continuously at ~20 Hz via WebSocket
- No authentication required (localhost only)
- CORS is enabled for all origins (development only)

---

*Last Updated: Complete API documentation for NRL Robot System*



