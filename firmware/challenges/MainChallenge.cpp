#include "MainChallenge.h"

MainChallenge::MainChallenge() {
  reset();
}

void MainChallenge::reset() {
  currentState = MAIN_IDLE;
  score.chargesScored = 0;
  score.goldenChargesScored = 0;
  score.goldenStacks = 0;
  score.chargeStationPoints = 0;
  score.csStatus = CS_NONE;
  score.superchargeModeActive = false;
  score.goldRushActive = false;
  currentCharge = CHARGE_NONE;
}

void MainChallenge::start() {
  reset();
  currentState = MAIN_START;
  score.matchStartTime = millis();
  stateStartTime = millis();
}

void MainChallenge::stop() {
  currentState = MAIN_END;
  score.elapsedTime = millis() - score.matchStartTime;
}

void MainChallenge::update() {
  unsigned long now = millis();
  score.elapsedTime = now - score.matchStartTime;
  
  // Check match end
  if (score.elapsedTime > MATCH_DURATION) {
    currentState = MAIN_END;
    return;
  }
  
  // Check Gold Rush start
  if (score.elapsedTime >= GOLD_RUSH_START && !score.goldRushActive) {
    score.goldRushActive = true;
  }
  
  // State machine logic
  switch (currentState) {
    case MAIN_START:
      currentState = MAIN_NAVIGATE_TO_SOURCE;
      stateStartTime = now;
      break;
      
    case MAIN_SCORE_CHARGE:
      if (currentCharge == CHARGE_GOLDEN) {
        score.goldenChargesScored++;
      } else {
        score.chargesScored++;
      }
      
      // Check for Supercharge eligibility
      if (score.chargesScored >= 8 && !score.superchargeModeActive) {
        // Human player can now activate
      }
      
      currentCharge = CHARGE_NONE;
      currentState = MAIN_NAVIGATE_TO_SOURCE;
      stateStartTime = now;
      break;
      
    case MAIN_PARK_CHARGE_STATION:
      // Determine parking status
      score.csStatus = CS_DOCK;  // Simplified
      score.chargeStationPoints = 7;  // Or 14 for partial park
      currentState = MAIN_END;
      break;
      
    default:
      break;
  }
}

MainState MainChallenge::getState() {
  return currentState;
}

MainChallengeScore MainChallenge::getScore() {
  return score;
}

ChargeType MainChallenge::getCurrentCharge() {
  return currentCharge;
}

bool MainChallenge::isFinished() {
  return currentState == MAIN_END || 
         score.elapsedTime > MATCH_DURATION;
}

bool MainChallenge::canActivateSupercharge() {
  return score.chargesScored >= 8 && !score.superchargeModeActive;
}

void MainChallenge::activateSupercharge() {
  if (canActivateSupercharge()) {
    score.superchargeModeActive = true;
  }
}




