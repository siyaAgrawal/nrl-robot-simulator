// ===============================
// NRL Robot - Complete System
// ESP32 + Arduino - All-in-One
// Supports: Auto Challenge & Main Challenge
// ===============================

#include <Arduino.h>
#include <ps5Controller.h>
#include <ESP32Servo.h>
#include <math.h>
#ifndef M_PI
#define M_PI 3.14159265358979323846
#endif

// ===== CONFIGURATION =====
#define PS5_MAC_ADDRESS "10:18:49:4D:07:E1"
#define TELEMETRY_RATE_MS 50  // 20 Hz

// ===== PIN DEFINITIONS =====
const int LEFT_PWM = 33;
const int LEFT_DIR = 32;
const int RIGHT_PWM = 26;
const int RIGHT_DIR = 25;
const int ARM_PIN = 14;
const int GRIPPER_PIN = 13;
const int QTR_PINS[8] = {2, 4, 5, 18, 19, 21, 22, 23};
const int TOF_SDA = 27;
const int TOF_SCL = 26;
const int LEFT_ENC_A = 34;
const int LEFT_ENC_B = 35;
const int RIGHT_ENC_A = 36;
const int RIGHT_ENC_B = 39;
const int BATTERY_PIN = A0;

// ===== PID CONTROLLER CLASS =====
class PIDController {
private:
  float kp, ki, kd;
  float integral;
  float lastError;
  float outputMin, outputMax;
  unsigned long lastTime;
  
public:
  PIDController(float p, float i, float d, float minOutput = -255, float maxOutput = 255) {
    kp = p; ki = i; kd = d;
    outputMin = minOutput; outputMax = maxOutput;
    integral = 0; lastError = 0; lastTime = millis();
  }
  
  float compute(float setpoint, float input) {
    unsigned long now = millis();
    float dt = (now - lastTime) / 1000.0;
    if (dt <= 0) dt = 0.01;
    
    float error = setpoint - input;
    integral += error * dt;
    if (integral > outputMax / ki) integral = outputMax / ki;
    if (integral < outputMin / ki) integral = outputMin / ki;
    
    float output = kp * error + ki * integral + kd * (error - lastError) / dt;
    output = constrain(output, outputMin, outputMax);
    
    lastError = error;
    lastTime = now;
    return output;
  }
  
  void reset() { integral = 0; lastError = 0; lastTime = millis(); }
  void setTunings(float p, float i, float d) { kp = p; ki = i; kd = d; }
};

// ===== LINE FOLLOWER CLASS =====
class LineFollower {
private:
  int sensorPins[8];
  int sensorValues[8];
  int lineThreshold;
  PIDController* pid;
  int lastError;
  
public:
  LineFollower(int pins[8], int threshold = 500) {
    for (int i = 0; i < 8; i++) {
      sensorPins[i] = pins[i];
      pinMode(pins[i], INPUT);
    }
    lineThreshold = threshold;
    lastError = 0;
    pid = new PIDController(2.0, 0.1, 0.5);
  }
  
  void update() {
    for (int i = 0; i < 8; i++) {
      sensorValues[i] = analogRead(sensorPins[i]);
    }
  }
  
  int getLineError() {
    long weightedSum = 0, totalWeight = 0;
    for (int i = 0; i < 8; i++) {
      int weight = sensorValues[i] > lineThreshold ? sensorValues[i] : 0;
      weightedSum += (i - 3.5) * weight * 1000;
      totalWeight += weight;
    }
    if (totalWeight == 0) return lastError;
    lastError = weightedSum / totalWeight;
    return lastError;
  }
  
  bool isOnLine() {
    int active = 0;
    for (int i = 0; i < 8; i++) {
      if (sensorValues[i] > lineThreshold) active++;
    }
    return active >= 3;
  }
  
  int getCorrection(int baseSpeed) {
    return (int)pid->compute(0, getLineError());
  }
  
  int* getSensorValues() { return sensorValues; }
};

// ===== MOTOR CONTROL =====
void setMotor(int pwmPin, int dirPin, int speed, bool reverse) {
  speed = constrain(speed, -255, 255);
  bool direction = (speed >= 0);
  if (reverse) direction = !direction;
  digitalWrite(dirPin, direction);
  
  if (pwmPin == LEFT_PWM) ledcWrite(0, abs(speed));
  else if (pwmPin == RIGHT_PWM) ledcWrite(1, abs(speed));
}

// ===== ROBOT MODES =====
enum RobotMode { MODE_MANUAL, MODE_AUTO_CHALLENGE, MODE_MAIN_CHALLENGE };
enum AutoState { AUTO_IDLE, AUTO_LINE_FOLLOW, AUTO_PICKUP, AUTO_DROPOFF, AUTO_FINISHED };

// ===== GLOBAL OBJECTS =====
LineFollower lineFollower(QTR_PINS, 500);
PIDController linePID(2.0, 0.1, 0.5);
Servo armServo, gripperServo;

RobotMode currentMode = MODE_MANUAL;
AutoState autoState = AUTO_IDLE;

// ===== SERVO POSITIONS =====
int armPos = 90, gripperPos = 90;
const int ARM_UP = 160, ARM_DOWN = 0;
const int GRIPPER_OPEN = 5, GRIPPER_CLOSE = 95;

// ===== SENSOR DATA =====
int tofDistance = -1;
long leftEnc = 0, rightEnc = 0;
int batteryRaw = 0;
int leftSpeed = 0, rightSpeed = 0;

// ===== CHALLENGE TRACKING =====
int chargesScored = 0;
int goldenChargesScored = 0;
int currentLap = 0;
int cornersCompleted = 0;
bool hasCharge = false;
bool superchargeActive = false;
bool goldRushActive = false;
unsigned long matchStartTime = 0;
unsigned long lastTelemetryTime = 0;

// ===== ENCODER INTERRUPTS =====
void IRAM_ATTR leftEncoderISR() {
  if (digitalRead(LEFT_ENC_B)) leftEnc++;
  else leftEnc--;
}

void IRAM_ATTR rightEncoderISR() {
  if (digitalRead(RIGHT_ENC_B)) rightEnc++;
  else rightEnc--;
}

// ===== SENSOR READING =====
int readTOFDistance() {
  // TODO: Implement actual TOF sensor (VL53L0X, HC-SR04, etc.)
  return -1;
}

// ===== TELEMETRY =====
void sendTelemetry() {
  unsigned long now = millis();
  if (now - lastTelemetryTime < TELEMETRY_RATE_MS) return;
  lastTelemetryTime = now;
  
  lineFollower.update();
  tofDistance = readTOFDistance();
  batteryRaw = analogRead(BATTERY_PIN);
  int lineError = lineFollower.getLineError();
  int* qtrVals = lineFollower.getSensorValues();
  
  // Send JSON telemetry
  Serial.print("{");
  Serial.print("\"mode\":\"");
  Serial.print(currentMode == MODE_MANUAL ? "manual" : 
               currentMode == MODE_AUTO_CHALLENGE ? "auto_challenge" : "main_challenge");
  Serial.print("\",\"cmd\":{");
  Serial.print("\"left_pwm\":");
  Serial.print(leftSpeed);
  Serial.print(",\"right_pwm\":");
  Serial.print(rightSpeed);
  Serial.print(",\"servo_grabber\":");
  Serial.print(gripperPos);
  Serial.print(",\"servo_arm\":");
  Serial.print(armPos);
  Serial.print("},\"battery\":{\"raw\":");
  Serial.print(batteryRaw);
  Serial.print("},\"line\":{\"error\":");
  Serial.print(lineError);
  Serial.print(",\"qtr\":[");
  for (int i = 0; i < 8; i++) {
    Serial.print(qtrVals[i]);
    if (i < 7) Serial.print(",");
  }
  Serial.print("]},\"distance\":{\"tof_front\":");
  Serial.print(tofDistance);
  Serial.print("},\"encoders\":{\"left\":");
  Serial.print(leftEnc);
  Serial.print(",\"right\":");
  Serial.print(rightEnc);
  Serial.print("}}");
  Serial.println();
}

// ===== MANUAL MODE =====
void updateManualMode() {
  if (ps5.isConnected()) {
    int speed = map(ps5.LStickY(), -128, 127, 255, -255);
    int turn = map(ps5.RStickX(), -128, 127, 255, -255);
    
    if (abs(speed) < 20) speed = 0;
    if (abs(turn) < 20) turn = 0;
    
    leftSpeed = constrain(speed + turn, -255, 255);
    rightSpeed = constrain(speed - turn, -255, 255);
    
    setMotor(LEFT_PWM, LEFT_DIR, leftSpeed, false);
    setMotor(RIGHT_PWM, RIGHT_DIR, rightSpeed, true);
    
    if (ps5.Triangle()) armPos = ARM_UP;
    if (ps5.Cross()) armPos = ARM_DOWN;
    if (ps5.Square()) gripperPos = GRIPPER_CLOSE;
    if (ps5.Circle()) gripperPos = GRIPPER_OPEN;
    
    armServo.write(armPos);
    gripperServo.write(gripperPos);
    
    // Start Auto Challenge
    if (ps5.Options()) {
      currentMode = MODE_AUTO_CHALLENGE;
      autoState = AUTO_LINE_FOLLOW;
      matchStartTime = millis();
      currentLap = 0;
      cornersCompleted = 0;
    }
  } else {
    leftSpeed = rightSpeed = 0;
    setMotor(LEFT_PWM, LEFT_DIR, 0, false);
    setMotor(RIGHT_PWM, RIGHT_DIR, 0, true);
  }
}

// ===== AUTO CHALLENGE MODE =====
void updateAutoChallenge() {
  lineFollower.update();
  
  if (!lineFollower.isOnLine()) {
    // Line lost - check timeout
    static unsigned long lineLostTime = 0;
    if (lineLostTime == 0) lineLostTime = millis();
    if (millis() - lineLostTime > 10000) {
      autoState = AUTO_FINISHED;
      return;
    }
  } else {
    lineLostTime = 0;
  }
  
  // Check match timeout (120 seconds)
  if (millis() - matchStartTime > 120000) {
    autoState = AUTO_FINISHED;
    return;
  }
  
  // Line following with PID
  int baseSpeed = 150;
  int correction = lineFollower.getCorrection(baseSpeed);
  leftSpeed = baseSpeed + correction;
  rightSpeed = baseSpeed - correction;
  
  setMotor(LEFT_PWM, LEFT_DIR, leftSpeed, false);
  setMotor(RIGHT_PWM, RIGHT_DIR, rightSpeed, true);
  
  // State machine for pickup/dropoff
  switch (autoState) {
    case AUTO_LINE_FOLLOW:
      // Detect spurs, corners, etc.
      cornersCompleted++;
      if (cornersCompleted >= 12) {  // 4 corners × 3 laps
        autoState = AUTO_FINISHED;
      }
      break;
      
    case AUTO_PICKUP:
      armPos = ARM_DOWN;
      gripperPos = GRIPPER_CLOSE;
      delay(1000);
      armPos = ARM_UP;
      hasCharge = true;
      autoState = AUTO_LINE_FOLLOW;
      break;
      
    case AUTO_DROPOFF:
      armPos = ARM_DOWN;
      gripperPos = GRIPPER_OPEN;
      delay(1000);
      armPos = ARM_UP;
      hasCharge = false;
      autoState = AUTO_LINE_FOLLOW;
      break;
      
    case AUTO_FINISHED:
      setMotor(LEFT_PWM, LEFT_DIR, 0, false);
      setMotor(RIGHT_PWM, RIGHT_DIR, 0, true);
      break;
  }
  
  armServo.write(armPos);
  gripperServo.write(gripperPos);
}

// ===== MAIN CHALLENGE MODE =====
void updateMainChallenge() {
  lineFollower.update();
  
  // Check match end (2:30 = 150 seconds)
  if (millis() - matchStartTime > 150000) {
    setMotor(LEFT_PWM, LEFT_DIR, 0, false);
    setMotor(RIGHT_PWM, RIGHT_DIR, 0, true);
    return;
  }
  
  // Check Gold Rush (starts at 2:00)
  if (millis() - matchStartTime > 120000 && !goldRushActive) {
    goldRushActive = true;
  }
  
  // Basic navigation
  int baseSpeed = 120;
  int correction = lineFollower.getCorrection(baseSpeed);
  leftSpeed = baseSpeed + correction;
  rightSpeed = baseSpeed - correction;
  
  setMotor(LEFT_PWM, LEFT_DIR, leftSpeed, false);
  setMotor(RIGHT_PWM, RIGHT_DIR, rightSpeed, true);
  
  // Check for Supercharge eligibility
  if (chargesScored >= 8 && !superchargeActive) {
    // Human player can activate Supercharge Mode
  }
}

// ===== SETUP =====
void setup() {
  Serial.begin(115200);
  Serial.println("NRL Robot System Starting...");
  
  // Motor pins
  pinMode(LEFT_DIR, OUTPUT);
  pinMode(LEFT_PWM, OUTPUT);
  pinMode(RIGHT_DIR, OUTPUT);
  pinMode(RIGHT_PWM, OUTPUT);
  
  // PWM setup
  ledcSetup(0, 5000, 8);
  ledcSetup(1, 5000, 8);
  ledcAttachPin(LEFT_PWM, 0);
  ledcAttachPin(RIGHT_PWM, 1);
  
  // Encoders
  pinMode(LEFT_ENC_A, INPUT_PULLUP);
  pinMode(LEFT_ENC_B, INPUT_PULLUP);
  pinMode(RIGHT_ENC_A, INPUT_PULLUP);
  pinMode(RIGHT_ENC_B, INPUT_PULLUP);
  attachInterrupt(digitalPinToInterrupt(LEFT_ENC_A), leftEncoderISR, RISING);
  attachInterrupt(digitalPinToInterrupt(RIGHT_ENC_A), rightEncoderISR, RISING);
  
  // Servos
  armServo.attach(ARM_PIN);
  gripperServo.attach(GRIPPER_PIN);
  armServo.write(armPos);
  gripperServo.write(gripperPos);
  
  // PS5 Controller
  ps5.begin(PS5_MAC_ADDRESS);
  Serial.println("Waiting for PS5 Controller...");
  Serial.println("Setup complete!");
}

// ===== MAIN LOOP =====
void loop() {
  // Check for commands from server
  if (Serial.available()) {
    String cmd = Serial.readStringUntil('\n');
    cmd.trim();
    cmd.toLowerCase();
    
    if (cmd == "start_autonomous") {
      currentMode = MODE_AUTO_CHALLENGE;
      autoState = AUTO_LINE_FOLLOW;
      matchStartTime = millis();
    } else if (cmd == "start_main_challenge") {
      currentMode = MODE_MAIN_CHALLENGE;
      matchStartTime = millis();
    } else if (cmd == "emergency_stop") {
      currentMode = MODE_MANUAL;
      setMotor(LEFT_PWM, LEFT_DIR, 0, false);
      setMotor(RIGHT_PWM, RIGHT_DIR, 0, true);
    }
  }
  
  // Update based on mode
  switch (currentMode) {
    case MODE_MANUAL:
      updateManualMode();
      break;
    case MODE_AUTO_CHALLENGE:
      updateAutoChallenge();
      break;
    case MODE_MAIN_CHALLENGE:
      updateMainChallenge();
      break;
  }
  
  // Send telemetry
  sendTelemetry();
  
  delay(20);
}

