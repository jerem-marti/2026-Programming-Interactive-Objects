/**
 * 6DOF IMU Visualizer on 32x32 RGB LED Matrix
 *
 * Reads the LSM6DS3 6-axis IMU (accelerometer + gyroscope) and renders
 * a real-time animation on the LED matrix where each axis drives a
 * distinct visual element:
 *
 *   Accelerometer:
 *     X → Horizontal position of a glowing cursor
 *     Y → Vertical position of a glowing cursor
 *     Z → Background brightness / pulse intensity
 *
 *   Gyroscope:
 *     X (pitch rate)  → Red channel wave
 *     Y (roll rate)   → Green channel wave
 *     Z (yaw rate)    → Blue channel wave / rotation of ring
 *
 * Wiring (LSM6DS3 Grove to PicoDriver v5 I2C header):
 *   SDA → GPIO 23
 *   SCL → GPIO 2
 *   VCC → 3.3V (or 5V if module has regulator)
 *   GND → GND
 *
 * Dependencies:
 *   https://github.com/Kameeno/SmartMatrix
 *   https://github.com/Seeed-Studio/Seeed_Arduino_LSM6DS3.git
 */

// Pinout configuration for the PicoDriver v.5.0
#include "pico_driver_v5_pinout.h"
#define USE_ADAFRUIT_GFX_LAYERS

#include <Arduino.h>
#include <SmartMatrix.h>
#include <Wire.h>
#include "LSM6DS3.h"
#include <math.h>

// ============================================================
// SmartMatrix configuration
// ============================================================
#define COLOR_DEPTH 24
#define TOTAL_WIDTH 32
#define TOTAL_HEIGHT 32
#define kRefreshDepth 24
#define kDmaBufferRows 4
#define kPanelType SM_PANELTYPE_HUB75_32ROW_32COL_MOD8SCAN
#define kMatrixOptions (SM_HUB75_OPTIONS_NONE)
#define kBackgroundLayerOptions (SM_BACKGROUND_OPTIONS_NONE)

SMARTMATRIX_ALLOCATE_BUFFERS(matrix, TOTAL_WIDTH, TOTAL_HEIGHT, kRefreshDepth, kDmaBufferRows, kPanelType, kMatrixOptions);
SMARTMATRIX_ALLOCATE_BACKGROUND_LAYER(backgroundLayer, TOTAL_WIDTH, TOTAL_HEIGHT, COLOR_DEPTH, kBackgroundLayerOptions);

// ============================================================
// IMU (LSM6DS3) configuration
// ============================================================
// I2C pins matching the PicoDriver v5 I2C header
#define I2C_SDA 23
#define I2C_SCL 2

LSM6DS3 imu(I2C_MODE, 0x6A);

// ============================================================
// Smoothed sensor data
// ============================================================
float accelX = 0, accelY = 0, accelZ = 0;
float gyroX = 0, gyroY = 0, gyroZ = 0;

// Low-pass filter coefficient (0..1, lower = smoother)
const float ALPHA = 0.15f;

// Integrated gyro angles for rotation effect
float angleX = 0, angleY = 0, angleZ = 0;

// ============================================================
// Helper math
// ============================================================
inline float clampf(float x, float lo, float hi) { return x < lo ? lo : (x > hi ? hi : x); }
inline float mapf(float x, float inMin, float inMax, float outMin, float outMax) {
  return outMin + (x - inMin) * (outMax - outMin) / (inMax - inMin);
}

// ============================================================
// Setup
// ============================================================
void setup() {
  Serial.begin(115200);

  // Initialize I2C on PicoDriver v5 I2C header pins
  Wire.begin(I2C_SDA, I2C_SCL);

  // Initialize SmartMatrix
  matrix.addLayer(&backgroundLayer);
  matrix.begin();
  matrix.setBrightness(128);

  // Initialize LSM6DS3
  Serial.println("Initializing LSM6DS3 6DOF IMU...");
  if (imu.begin() != 0) {
    Serial.println("ERROR: LSM6DS3 not found! Check wiring.");
    // Show red error pixel
    backgroundLayer.fillScreen({0, 0, 0});
    backgroundLayer.drawPixel(0, 0, (rgb24){255, 0, 0});
    backgroundLayer.swapBuffers();
    while (1) { delay(1000); }
  }
  Serial.println("LSM6DS3 ready. 6DOF visualizer running.");
}

// ============================================================
// Read and filter sensor data
// ============================================================
void readIMU() {
  // Raw reads (accel in g, gyro in deg/s)
  float rawAX = imu.readFloatAccelX();
  float rawAY = imu.readFloatAccelY();
  float rawAZ = imu.readFloatAccelZ();
  float rawGX = imu.readFloatGyroX();
  float rawGY = imu.readFloatGyroY();
  float rawGZ = imu.readFloatGyroZ();

  // Exponential moving average filter
  accelX = accelX + ALPHA * (rawAX - accelX);
  accelY = accelY + ALPHA * (rawAY - accelY);
  accelZ = accelZ + ALPHA * (rawAZ - accelZ);
  gyroX  = gyroX  + ALPHA * (rawGX - gyroX);
  gyroY  = gyroY  + ALPHA * (rawGY - gyroY);
  gyroZ  = gyroZ  + ALPHA * (rawGZ - gyroZ);

  // Integrate gyro for cumulative angle (simple Euler, for visual effect)
  float dt = 0.02f; // ~50 Hz loop
  angleX += gyroX * dt;
  angleY += gyroY * dt;
  angleZ += gyroZ * dt;

  // Keep angles in [-360, 360] range
  if (angleX > 360.0f) angleX -= 360.0f;
  if (angleX < -360.0f) angleX += 360.0f;
  if (angleY > 360.0f) angleY -= 360.0f;
  if (angleY < -360.0f) angleY += 360.0f;
  if (angleZ > 360.0f) angleZ -= 360.0f;
  if (angleZ < -360.0f) angleZ += 360.0f;
}

// ============================================================
// Render frame
// ============================================================
void renderFrame(float iTime) {
  const float cx = TOTAL_WIDTH  / 2.0f;
  const float cy = TOTAL_HEIGHT / 2.0f;

  // --- Map accelerometer to cursor position ---
  // Accel X,Y are roughly -1..+1 g when tilted
  float cursorX = cx + clampf(accelX, -1.0f, 1.0f) * (cx - 1.0f);
  float cursorY = cy - clampf(accelY, -1.0f, 1.0f) * (cy - 1.0f); // invert Y for natural tilt

  // Accel Z: ~1g upright, ~0 on side → map to background intensity
  float zIntensity = clampf(mapf(accelZ, -0.2f, 1.2f, 0.0f, 1.0f), 0.0f, 1.0f);

  // --- Map gyroscope to wave parameters ---
  // Gyro values can be +-250 deg/s typical; we normalize
  float gxNorm = clampf(gyroX / 250.0f, -1.0f, 1.0f);
  float gyNorm = clampf(gyroY / 250.0f, -1.0f, 1.0f);
  float gzNorm = clampf(gyroZ / 250.0f, -1.0f, 1.0f);

  // Integrated angle Z drives a rotation
  float rotRad = angleZ * (M_PI / 180.0f);

  for (int py = 0; py < TOTAL_HEIGHT; py++) {
    for (int px = 0; px < TOTAL_WIDTH; px++) {
      // Pixel position relative to center
      float dx = (float)px - cx;
      float dy = (float)py - cy;
      float dist = sqrtf(dx * dx + dy * dy);
      float angle = atan2f(dy, dx);

      // ---- Layer 1: Background gradient driven by accelZ ----
      float bgVal = zIntensity * 0.12f;
      float bgR = bgVal * 0.3f;
      float bgG = bgVal * 0.1f;
      float bgB = bgVal * 0.5f;

      // ---- Layer 2: Gyro-driven colored ripples ----
      // Each gyro axis creates a sine wave ripple in its color channel
      // The wave frequency increases with rotation speed

      // GyroX → red wave radiating from center
      float waveR = sinf(dist * 0.6f - iTime * 3.0f + fabsf(gxNorm) * 8.0f) * 0.5f + 0.5f;
      waveR *= fabsf(gxNorm); // intensity proportional to rotation speed
      // Fade with distance
      waveR *= clampf(1.0f - dist / 22.0f, 0.0f, 1.0f);

      // GyroY → green wave
      float waveG = sinf(dist * 0.5f - iTime * 2.5f + fabsf(gyNorm) * 6.0f) * 0.5f + 0.5f;
      waveG *= fabsf(gyNorm);
      waveG *= clampf(1.0f - dist / 22.0f, 0.0f, 1.0f);

      // GyroZ → blue rotating ring
      float ringAngle = angle - rotRad;
      float ring = sinf(ringAngle * 3.0f) * 0.5f + 0.5f;
      float ringMask = (1.0f - fabsf(dist - 10.0f) / 4.0f);
      ringMask = clampf(ringMask, 0.0f, 1.0f);
      float waveB = ring * ringMask * clampf(fabsf(gzNorm) + 0.3f, 0.0f, 1.0f);

      // ---- Layer 3: Accelerometer cursor glow ----
      float cdx = (float)px - cursorX;
      float cdy = (float)py - cursorY;
      float cdist = sqrtf(cdx * cdx + cdy * cdy);

      // Soft glow falloff
      float glow = 1.0f / (1.0f + cdist * cdist * 0.15f);
      // Pulse with time
      glow *= 0.7f + 0.3f * sinf(iTime * 4.0f);

      // Cursor color: warm white/yellow
      float glowR = glow * 1.0f;
      float glowG = glow * 0.85f;
      float glowB = glow * 0.4f;

      // ---- Layer 4: Subtle axis indicator crosshair ----
      float crossR = 0.0f, crossG = 0.0f, crossB = 0.0f;
      // Show thin lines at center, colored by accel tilt
      if (fabsf(dx) < 0.8f) {
        // Vertical line — accelY
        float lineIntensity = clampf(1.0f - fabsf(dy) / 16.0f, 0.0f, 0.5f) * 0.15f;
        crossG = lineIntensity * clampf(fabsf(accelY), 0.0f, 1.0f);
      }
      if (fabsf(dy) < 0.8f) {
        // Horizontal line — accelX
        float lineIntensity = clampf(1.0f - fabsf(dx) / 16.0f, 0.0f, 0.5f) * 0.15f;
        crossR = lineIntensity * clampf(fabsf(accelX), 0.0f, 1.0f);
      }

      // ---- Combine all layers ----
      float r = bgR + waveR * 0.6f + glowR + crossR;
      float g = bgG + waveG * 0.6f + glowG + crossG;
      float b = bgB + waveB * 0.6f + glowB + crossB;

      // Clamp and write pixel
      uint8_t pr = (uint8_t)(clampf(r, 0.0f, 1.0f) * 255.0f);
      uint8_t pg = (uint8_t)(clampf(g, 0.0f, 1.0f) * 255.0f);
      uint8_t pb = (uint8_t)(clampf(b, 0.0f, 1.0f) * 255.0f);

      backgroundLayer.drawPixel(px, py, (rgb24){pr, pg, pb});
    }
  }
}

// ============================================================
// Main loop
// ============================================================
void loop() {
  readIMU();

  float iTime = millis() / 1000.0f;
  renderFrame(iTime);
  backgroundLayer.swapBuffers();

  // Debug output every 500ms
  static unsigned long lastPrint = 0;
  if (millis() - lastPrint > 500) {
    lastPrint = millis();
    Serial.printf("Accel X:%.2f Y:%.2f Z:%.2f | Gyro X:%.1f Y:%.1f Z:%.1f | Angle Z:%.1f\n",
      accelX, accelY, accelZ, gyroX, gyroY, gyroZ, angleZ);
  }

  delay(20); // ~50 Hz
}
