#ifndef AUTO_CHALLENGE_H
#define AUTO_CHALLENGE_H

#include <Arduino.h>

enum AutoState {
  AUTO_IDLE,
  AUTO_LINE_FOLLOW,
  AUTO_DETECT_PICKUP_SPUR,
  AUTO_TURN_PICKUP_SPUR,
  AUTO_ENTER_PICKUP_SPUR,
  AUTO_PICKUP_CHARGE,
  AUTO_EXIT_PICKUP_SPUR,
  AUTO_DETECT_DROPOFF_SPUR,
  AUTO_TURN_DROPOFF_SPUR,
  AUTO_ENTER_DROPOFF_SPUR,
  AUTO_DROPOFF_CHARGE,
  AUTO_EXIT_DROPOFF_SPUR,
  AUTO_COMPLETE_LAP,
  AUTO_FINISHED
};

struct AutoChallengeScore {
  int corners;           // 5 pts each (max 60)
  int pickupSuccess;     // 15 pts
  int dropoffSuccess;    // 15 pts
  int lap1Bonus;         // 10 pts
  int lap2Bonus;         // 5 pts
  int lap3Bonus;         // 5 pts
  int totalScore;        // Max 155
  int currentLap;
  int cornersThisLap;
  bool pickupCompleted;
  bool dropoffCompleted;
  unsigned long startTime;
  unsigned long elapsedTime;
};

class AutoChallenge {
private:
  AutoState currentState;
  AutoChallengeScore score;
  bool hasCharge;
  unsigned long stateStartTime;
  unsigned long lineLostTime;
  const unsigned long LINE_RECOVERY_TIME = 10000;  // 10 seconds
  const unsigned long MAX_MATCH_TIME = 120000;      // 120 seconds
  
public:
  AutoChallenge();
  void start();
  void stop();
  void update();
  AutoState getState();
  AutoChallengeScore getScore();
  bool isFinished();
  bool isLineLost();
  void reset();
};

#endif




