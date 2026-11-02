#ifndef COMMUNICATION_H
#define COMMUNICATION_H

#include <Arduino.h>

enum CommandType {
  CMD_NONE,
  CMD_START_AUTO_CHALLENGE,
  CMD_START_MAIN_CHALLENGE,
  CMD_EMERGENCY_STOP,
  CMD_SET_MOTOR_POWER,
  CMD_SET_GRIPPER_STATE
};

struct RobotCommand {
  CommandType type;
  int params[4];
  bool valid;
};

class Communication {
private:
  String commandBuffer;
  
public:
  Communication();
  void begin(unsigned long baudRate);
  void processCommands();
  RobotCommand parseCommand(String cmd);
  void sendResponse(String response);
  bool hasCommand();
};

#endif




