#ifndef MAIN_CHALLENGE_H
#define MAIN_CHALLENGE_H

#include <Arduino.h>

enum ChargeType {
  CHARGE_NONE,
  CHARGE_RED,
  CHARGE_BLUE,
  CHARGE_GOLDEN
};

enum MainState {
  MAIN_IDLE,
  MAIN_START,
  MAIN_NAVIGATE_TO_SOURCE,
  MAIN_PICKUP_CHARGE,
  MAIN_NAVIGATE_TO_DROP,
  MAIN_SCORE_CHARGE,
  MAIN_NAVIGATE_TO_CHARGE_STATION,
  MAIN_PARK_CHARGE_STATION,
  MAIN_GOLD_RUSH_MODE,
  MAIN_END
};

enum ChargeStationStatus {
  CS_NONE,
  CS_ENGAGE,
  CS_DOCK,
  CS_FULL_PARK
};

struct MainChallengeScore {
  int chargesScored;           // Squad-specific CHARGES
  int goldenChargesScored;     // Golden CHARGES
  int goldenStacks;            // Stacked Golden CHARGES
  int chargeStationPoints;     // 7, 14, or higher
  ChargeStationStatus csStatus;
  bool superchargeModeActive;
  bool goldRushActive;
  unsigned long matchStartTime;
  unsigned long elapsedTime;
  int totalScore;
};

class MainChallenge {
private:
  MainState currentState;
  MainChallengeScore score;
  ChargeType currentCharge;
  unsigned long stateStartTime;
  const unsigned long MATCH_DURATION = 150000;  // 2:30
  const unsigned long GOLD_RUSH_START = 120000; // 2:00
  
public:
  MainChallenge();
  void start();
  void stop();
  void update();
  MainState getState();
  MainChallengeScore getScore();
  ChargeType getCurrentCharge();
  bool isFinished();
  bool canActivateSupercharge();
  void activateSupercharge();
  void reset();
};

#endif




