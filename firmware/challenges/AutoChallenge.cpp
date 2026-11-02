#include "AutoChallenge.h"

AutoChallenge::AutoChallenge() {
  reset();
}

void AutoChallenge::reset() {
  currentState = AUTO_IDLE;
  score.corners = 0;
  score.pickupSuccess = 0;
  score.dropoffSuccess = 0;
  score.lap1Bonus = 0;
  score.lap2Bonus = 0;
  score.lap3Bonus = 0;
  score.totalScore = 0;
  score.currentLap = 0;
  score.cornersThisLap = 0;
  score.pickupCompleted = false;
  score.dropoffCompleted = false;
  hasCharge = false;
  lineLostTime = 0;
}

void AutoChallenge::start() {
  reset();
  currentState = AUTO_LINE_FOLLOW;
  score.startTime = millis();
  stateStartTime = millis();
}

void AutoChallenge::stop() {
  currentState = AUTO_IDLE;
  score.elapsedTime = millis() - score.startTime;
}

void AutoChallenge::update() {
  unsigned long now = millis();
  score.elapsedTime = now - score.startTime;
  
  // Check timeout
  if (score.elapsedTime > MAX_MATCH_TIME) {
    currentState = AUTO_FINISHED;
    return;
  }
  
  // State machine logic
  switch (currentState) {
    case AUTO_LINE_FOLLOW:
      // Check for spurs, corners, etc.
      score.cornersThisLap++;
      if (score.cornersThisLap >= 4) {
        score.currentLap++;
        score.cornersThisLap = 0;
        
        // Lap bonuses
        if (score.currentLap == 1) score.lap1Bonus = 10;
        else if (score.currentLap == 2) score.lap2Bonus = 5;
        else if (score.currentLap == 3) score.lap3Bonus = 5;
        
        if (score.currentLap >= 3) {
          currentState = AUTO_FINISHED;
        }
      }
      break;
      
    case AUTO_PICKUP_CHARGE:
      hasCharge = true;
      score.pickupSuccess = 15;
      currentState = AUTO_EXIT_PICKUP_SPUR;
      stateStartTime = now;
      break;
      
    case AUTO_DROPOFF_CHARGE:
      hasCharge = false;
      score.dropoffSuccess = 15;
      currentState = AUTO_EXIT_DROPOFF_SPUR;
      stateStartTime = now;
      break;
      
    default:
      break;
  }
  
  // Calculate total score
  score.totalScore = (score.corners * 5) + score.pickupSuccess + 
                     score.dropoffSuccess + score.lap1Bonus + 
                     score.lap2Bonus + score.lap3Bonus;
}

AutoState AutoChallenge::getState() {
  return currentState;
}

AutoChallengeScore AutoChallenge::getScore() {
  return score;
}

bool AutoChallenge::isFinished() {
  return currentState == AUTO_FINISHED || 
         score.elapsedTime > MAX_MATCH_TIME ||
         score.currentLap >= 3;
}

bool AutoChallenge::isLineLost() {
  if (lineLostTime > 0) {
    if (millis() - lineLostTime > LINE_RECOVERY_TIME) {
      return true;  // Line lost for more than 10 seconds
    }
  }
  return false;
}




