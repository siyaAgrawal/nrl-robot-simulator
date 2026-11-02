#include "LineFollower.h"

LineFollower::LineFollower(int pins[8], int threshold) {
  for (int i = 0; i < 8; i++) {
    sensorPins[i] = pins[i];
    pinMode(pins[i], INPUT);
  }
  lineThreshold = threshold;
  lastError = 0;
  pidController = new PIDController(2.0, 0.1, 0.5);
}

void LineFollower::update() {
  for (int i = 0; i < 8; i++) {
    sensorValues[i] = analogRead(sensorPins[i]);
  }
}

int LineFollower::getLineError() {
  long weightedSum = 0;
  long totalWeight = 0;
  
  for (int i = 0; i < 8; i++) {
    int weight = sensorValues[i] > lineThreshold ? sensorValues[i] : 0;
    weightedSum += (i - 3.5) * weight * 1000;
    totalWeight += weight;
  }
  
  if (totalWeight == 0) {
    return lastError;  // Return last known error if line lost
  }
  
  lastError = weightedSum / totalWeight;
  return lastError;
}

float LineFollower::getLinePosition() {
  int error = getLineError();
  return constrain((float)error / 3500.0, -1.0, 1.0);
}

bool LineFollower::isOnLine() {
  int activeSensors = 0;
  for (int i = 0; i < 8; i++) {
    if (sensorValues[i] > lineThreshold) activeSensors++;
  }
  return activeSensors >= 3;
}

int LineFollower::getCorrection(int baseSpeed) {
  int error = getLineError();
  float correction = pidController->compute(0, error);
  return (int)correction;
}

int* LineFollower::getSensorValues() {
  return sensorValues;
}




