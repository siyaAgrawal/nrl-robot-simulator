#ifndef LINE_FOLLOWER_H
#define LINE_FOLLOWER_H

#include <Arduino.h>
#include "PIDController.h"

class LineFollower {
private:
  int sensorPins[8];
  int sensorValues[8];
  int lineThreshold;
  PIDController* pidController;
  int lastError;
  
public:
  LineFollower(int pins[8], int threshold = 500);
  void update();
  int getLineError();  // -3500 to +3500
  float getLinePosition();  // -1.0 to 1.0
  bool isOnLine();
  int getCorrection(int baseSpeed);
  int* getSensorValues();
};

#endif




