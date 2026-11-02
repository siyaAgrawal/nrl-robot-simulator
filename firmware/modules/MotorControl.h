#ifndef MOTOR_CONTROL_H
#define MOTOR_CONTROL_H

#include <Arduino.h>

class MotorControl {
private:
  int pwmPins[4];
  int dirPins[4];
  bool reverse[4];
  int currentSpeeds[4];
  int pwmChannels[4];
  
public:
  MotorControl();
  void initialize(int leftPWM, int leftDIR, int rightPWM, int rightDIR,
                  bool revLeft = false, bool revRight = true);
  void setSpeed(int motor, int speed);  // -255 to 255
  void setDifferential(int leftSpeed, int rightSpeed);
  void stop();
  void stop(int motor);
  int* getCurrentSpeeds();
};

#endif




