// ===============================
// Sensor Calibration Tool
// ===============================
// Use this sketch to calibrate your sensors before running the main robot code
// Upload this, open Serial Monitor at 115200 baud, and follow the prompts

#include <Arduino.h>

// ===== CONFIGURE YOUR PINS HERE =====
// QTR Line Sensor Pins (update to match your wiring)
const int QTR_PINS[8] = {2, 4, 5, 18, 19, 21, 22, 23};

// TOF Distance Sensor (if you have one connected)
// const int TOF_SDA = 27;
// const int TOF_SCL = 26;

// Battery Monitor Pin
const int BATTERY_PIN = A0;

void setup() {
  Serial.begin(115200);
  delay(1000);
  
  Serial.println("\n========================================");
  Serial.println("   SENSOR CALIBRATION TOOL");
  Serial.println("========================================\n");
  
  // Setup QTR pins as inputs
  for (int i = 0; i < 8; i++) {
    pinMode(QTR_PINS[i], INPUT);
  }
  
  Serial.println("Ready! Place robot on calibration surface.");
  Serial.println("Press any key to start calibration...\n");
}

void loop() {
  if (Serial.available()) {
    Serial.read(); // Clear buffer
    
    Serial.println("\n=== QTR LINE SENSOR CALIBRATION ===\n");
    Serial.println("Instructions:");
    Serial.println("1. Place robot on WHITE surface");
    Serial.println("2. Press any key to read white values...");
    while (!Serial.available());
    Serial.read();
    
    int whiteValues[8];
    Serial.print("Reading white values: ");
    for (int i = 0; i < 8; i++) {
      whiteValues[i] = analogRead(QTR_PINS[i]);
      Serial.print(whiteValues[i]);
      if (i < 7) Serial.print(", ");
      delay(50);
    }
    Serial.println();
    
    Serial.println("\n3. Place robot on BLACK line");
    Serial.println("4. Press any key to read black values...");
    while (!Serial.available());
    Serial.read();
    
    int blackValues[8];
    Serial.print("Reading black values: ");
    for (int i = 0; i < 8; i++) {
      blackValues[i] = analogRead(QTR_PINS[i]);
      Serial.print(blackValues[i]);
      if (i < 7) Serial.print(", ");
      delay(50);
    }
    Serial.println();
    
    // Calculate threshold (midpoint between white and black)
    Serial.println("\n=== RECOMMENDED THRESHOLD VALUES ===");
    for (int i = 0; i < 8; i++) {
      int threshold = (whiteValues[i] + blackValues[i]) / 2;
      Serial.print("Sensor ");
      Serial.print(i);
      Serial.print(" threshold: ");
      Serial.println(threshold);
    }
    
    // Overall threshold (average)
    int avgThreshold = 0;
    for (int i = 0; i < 8; i++) {
      avgThreshold += (whiteValues[i] + blackValues[i]) / 2;
    }
    avgThreshold /= 8;
    
    Serial.print("\n=== RECOMMENDED LINE_THRESHOLD for robot_control.ino ===");
    Serial.print("\nconst int LINE_THRESHOLD = ");
    Serial.print(avgThreshold);
    Serial.println(";");
    
    Serial.println("\n=== CONTINUOUS READING MODE ===");
    Serial.println("Now showing live sensor readings (press any key to stop)...\n");
    
    unsigned long startTime = millis();
    while (millis() - startTime < 10000) { // Run for 10 seconds
      if (Serial.available()) {
        Serial.read();
        break;
      }
      
      Serial.print("QTR: [");
      for (int i = 0; i < 8; i++) {
        int val = analogRead(QTR_PINS[i]);
        Serial.print(val);
        if (i < 7) Serial.print(", ");
      }
      Serial.print("] | Battery: ");
      Serial.print(analogRead(BATTERY_PIN));
      Serial.println();
      
      delay(200);
    }
    
    Serial.println("\n=== CALIBRATION COMPLETE ===");
    Serial.println("Update LINE_THRESHOLD in robot_control.ino with the value above.\n");
    Serial.println("Press any key to run calibration again...\n");
  }
  
  delay(100);
}




