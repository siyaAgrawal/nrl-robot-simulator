#include "MotorControl.h"

MotorControl::MotorControl() {
  for (int i = 0; i < 4; i++) {
    currentSpeeds[i] = 0;
    pwmChannels[i] = i;
  }
}

void MotorControl::initialize(int leftPWM, int leftDIR, int rightPWM, int rightDIR,
                              bool revLeft, bool revRight) {
  pwmPins[0] = leftPWM;
  dirPins[0] = leftDIR;
  reverse[0] = revLeft;
  
  pwmPins[1] = rightPWM;
  dirPins[1] = rightDIR;
  reverse[1] = revRight;
  
  // Initialize pins
  pinMode(dirPins[0], OUTPUT);
  pinMode(dirPins[1], OUTPUT);
  
  // Setup PWM channels for ESP32
  for (int i = 0; i < 2; i++) {
    ledcSetup(i, 5000, 8);  // 5kHz, 8-bit
    ledcAttachPin(pwmPins[i], i);
  }
}

void MotorControl::setSpeed(int motor, int speed) {
  if (motor < 0 || motor >= 4) return;
  
  speed = constrain(speed, -255, 255);
  bool direction = (speed >= 0);
  if (reverse[motor]) direction = !direction;
  
  digitalWrite(dirPins[motor], direction);
  ledcWrite(pwmChannels[motor], abs(speed));
  currentSpeeds[motor] = speed;
}

void MotorControl::setDifferential(int leftSpeed, int rightSpeed) {
  setSpeed(0, leftSpeed);
  setSpeed(1, rightSpeed);
}

void MotorControl::stop() {
  for (int i = 0; i < 4; i++) {
    setSpeed(i, 0);
  }
}

void MotorControl::stop(int motor) {
  setSpeed(motor, 0);
}

int* MotorControl::getCurrentSpeeds() {
  return currentSpeeds;
}




