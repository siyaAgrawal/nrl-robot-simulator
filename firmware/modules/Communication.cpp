#include "Communication.h"

Communication::Communication() {
  commandBuffer = "";
}

void Communication::begin(unsigned long baudRate) {
  Serial.begin(baudRate);
}

void Communication::processCommands() {
  while (Serial.available()) {
    char c = Serial.read();
    if (c == '\n' || c == '\r') {
      if (commandBuffer.length() > 0) {
        RobotCommand cmd = parseCommand(commandBuffer);
        // Process command here
        commandBuffer = "";
      }
    } else {
      commandBuffer += c;
    }
  }
}

RobotCommand Communication::parseCommand(String cmd) {
  RobotCommand result;
  result.type = CMD_NONE;
  result.valid = false;
  
  cmd.trim();
  cmd.toLowerCase();
  
  if (cmd.startsWith("start_autonomous")) {
    result.type = CMD_START_AUTO_CHALLENGE;
    result.valid = true;
  } else if (cmd.startsWith("start_main_challenge")) {
    result.type = CMD_START_MAIN_CHALLENGE;
    result.valid = true;
  } else if (cmd.startsWith("emergency_stop")) {
    result.type = CMD_EMERGENCY_STOP;
    result.valid = true;
  }
  
  return result;
}

void Communication::sendResponse(String response) {
  Serial.println(response);
}

bool Communication::hasCommand() {
  return Serial.available() > 0;
}




