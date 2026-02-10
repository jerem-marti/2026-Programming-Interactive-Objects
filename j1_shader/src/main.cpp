/**
 * Synthwave shader rendered on a 32x32 RGB LED matrix.
 *
 * Ported from GLSL (Shadertoy) to C++ for SmartMatrix.
 * Original shader: sun & grid by Jan Mróz (jaszunio15)
 * Shader License: CC BY 3.0
 *
 * Dependencies:
 * https://github.com/Kameeno/SmartMatrix
 */

// Pinout configuration for the PicoDriver v.5.0
#include "pico_driver_v5_pinout.h"
#define USE_ADAFRUIT_GFX_LAYERS

#include <Arduino.h>
#include <SmartMatrix.h>
#include <math.h>

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
// GLSL-like vector math helpers
// ============================================================

struct vec2 {
  float x, y;
  vec2() : x(0), y(0) {}
  vec2(float a) : x(a), y(a) {}
  vec2(float a, float b) : x(a), y(b) {}
};

struct vec3 {
  float r, g, b;
  vec3() : r(0), g(0), b(0) {}
  vec3(float a) : r(a), g(a), b(a) {}
  vec3(float a, float b, float c) : r(a), g(b), b(c) {}
};

// vec2 operators
inline vec2 operator+(vec2 a, vec2 b) { return {a.x + b.x, a.y + b.y}; }
inline vec2 operator-(vec2 a, vec2 b) { return {a.x - b.x, a.y - b.y}; }
inline vec2 operator*(vec2 a, vec2 b) { return {a.x * b.x, a.y * b.y}; }
inline vec2 operator*(vec2 a, float s) { return {a.x * s, a.y * s}; }
inline vec2 operator*(float s, vec2 a) { return {a.x * s, a.y * s}; }
inline vec2 operator-(vec2 a) { return {-a.x, -a.y}; }

// vec3 operators
inline vec3 operator+(vec3 a, vec3 b) { return {a.r + b.r, a.g + b.g, a.b + b.b}; }
inline vec3 operator-(vec3 a, vec3 b) { return {a.r - b.r, a.g - b.g, a.b - b.b}; }
inline vec3 operator*(vec3 a, vec3 b) { return {a.r * b.r, a.g * b.g, a.b * b.b}; }
inline vec3 operator*(vec3 a, float s) { return {a.r * s, a.g * s, a.b * s}; }
inline vec3 operator*(float s, vec3 a) { return {a.r * s, a.g * s, a.b * s}; }

// GLSL built-in functions
inline float clampf(float x, float lo, float hi) { return x < lo ? lo : (x > hi ? hi : x); }
inline float mixf(float a, float b, float t) { return a + (b - a) * t; }
inline vec3 mix3(vec3 a, vec3 b, float t) { return {mixf(a.r, b.r, t), mixf(a.g, b.g, t), mixf(a.b, b.b, t)}; }
inline float smoothstep(float edge0, float edge1, float x) {
  float t = clampf((x - edge0) / (edge1 - edge0), 0.0f, 1.0f);
  return t * t * (3.0f - 2.0f * t);
}
inline float length2(vec2 v) { return sqrtf(v.x * v.x + v.y * v.y); }
inline float dot2(vec2 v) { return v.x * v.x + v.y * v.y; } // dot(v,v)
inline float dotv(vec2 a, vec2 b) { return a.x * b.x + a.y * b.y; }
inline float fractf(float x) { return x - floorf(x); }
inline vec2 absv2(vec2 v) { return {fabsf(v.x), fabsf(v.y)}; }
inline vec2 fractv2(vec2 v) { return {fractf(v.x), fractf(v.y)}; }
inline vec2 maxv2(vec2 a, vec2 b) { return {fmaxf(a.x, b.x), fmaxf(a.y, b.y)}; }
inline vec2 minv2(vec2 a, vec2 b) { return {fminf(a.x, b.x), fminf(a.y, b.y)}; }
inline float step(float edge, float x) { return x < edge ? 0.0f : 1.0f; }

// ============================================================
// Shader functions (ported from GLSL)
// ============================================================

float sun(vec2 uv, float battery, float iTime) {
  float val = smoothstep(0.3f, 0.29f, length2(uv));
  float bloom = smoothstep(0.7f, 0.0f, length2(uv));
  float cut = 3.0f * sinf((uv.y + iTime * 0.2f * (battery + 0.02f)) * 100.0f)
              + clampf(uv.y * 14.0f + 1.0f, -6.0f, 6.0f);
  cut = clampf(cut, 0.0f, 1.0f);
  return clampf(val * cut, 0.0f, 1.0f) + bloom * 0.6f;
}

float grid(vec2 uv, float battery, float iTime) {
  vec2 size = {uv.y * 0.01f, uv.y * uv.y * 0.2f * 0.01f};
  uv = uv + vec2(0.0f, iTime * 4.0f * (battery + 0.05f));
  uv = absv2(fractv2(uv) - vec2(0.5f));
  vec2 lines = {smoothstep(size.x, 0.0f, uv.x), smoothstep(size.y, 0.0f, uv.y)};
  vec2 lines2 = {smoothstep(size.x * 5.0f, 0.0f, uv.x), smoothstep(size.y * 5.0f, 0.0f, uv.y)};
  lines = lines + lines2 * (0.4f * battery);
  return clampf(lines.x + lines.y, 0.0f, 3.0f);
}

float sdTrapezoid(vec2 p, float r1, float r2, float he) {
  vec2 k1 = {r2, he};
  vec2 k2 = {r2 - r1, 2.0f * he};
  p.x = fabsf(p.x);
  float cay = fabsf(p.y) - he;
  float cax = p.x - fminf(p.x, (p.y < 0.0f) ? r1 : r2);
  vec2 ca = {cax, cay};

  // cb = p - k1 + k2 * clamp(dot(k1-p, k2) / dot(k2,k2), 0, 1)
  vec2 k1mp = k1 - p;
  float t = clampf(dotv(k1mp, k2) / dot2(k2), 0.0f, 1.0f);
  vec2 cb = p - k1 + k2 * t;

  float s = (cb.x < 0.0f && ca.y < 0.0f) ? -1.0f : 1.0f;
  return s * sqrtf(fminf(dot2(ca), dot2(cb)));
}

float sdLine(vec2 p, vec2 a, vec2 b) {
  vec2 pa = p - a;
  vec2 ba = b - a;
  float h = clampf(dotv(pa, ba) / dotv(ba, ba), 0.0f, 1.0f);
  return length2(pa - ba * h);
}

float sdBox(vec2 p, vec2 b) {
  vec2 d = absv2(p) - b;
  return length2(maxv2(d, vec2(0.0f))) + fminf(fmaxf(d.x, d.y), 0.0f);
}

float opSmoothUnion(float d1, float d2, float k) {
  float h = clampf(0.5f + 0.5f * (d2 - d1) / k, 0.0f, 1.0f);
  return mixf(d2, d1, h) - k * h * (1.0f - h);
}

float sdCloud(vec2 p, vec2 a1, vec2 b1, vec2 a2, vec2 b2, float w) {
  float lineVal1 = sdLine(p, a1, b1);
  float lineVal2 = sdLine(p, a2, b2);
  vec2 ww = {w * 1.5f, 0.0f};
  vec2 left = maxv2(a1 + ww, a2 + ww);
  vec2 right = minv2(b1 - ww, b2 - ww);
  vec2 boxCenter = (left + right) * 0.5f;
  float boxH = fabsf(a2.y - a1.y) * 0.5f;
  float boxVal = sdBox(p - boxCenter, vec2(0.04f, boxH)) + w;

  float uniVal1 = opSmoothUnion(lineVal1, boxVal, 0.05f);
  float uniVal2 = opSmoothUnion(lineVal2, boxVal, 0.05f);

  return fminf(uniVal1, uniVal2);
}

// ============================================================
// Main rendering
// ============================================================

void renderFrame(float iTime) {
  const float resX = (float)TOTAL_WIDTH;
  const float resY = (float)TOTAL_HEIGHT;
  const float battery = 1.0f;

  for (int py = 0; py < TOTAL_HEIGHT; py++) {
    for (int px = 0; px < TOTAL_WIDTH; px++) {
      // Map pixel to normalized coordinates (like Shadertoy)
      float fragX = (float)px + 0.5f;
      float fragY = (float)(TOTAL_HEIGHT - 1 - py) + 0.5f; // flip Y for screen coords
      vec2 uv = {(2.0f * fragX - resX) / resY, (2.0f * fragY - resY) / resY};

      vec3 col;

      // Grid (bottom half)
      float fog = smoothstep(0.1f, -0.02f, fabsf(uv.y + 0.2f));
      col = vec3(0.0f, 0.1f, 0.2f);

      if (uv.y < -0.2f) {
        uv.y = 3.0f / (fabsf(uv.y + 0.2f) + 0.05f);
        uv.x *= uv.y * 1.0f;
        float gridVal = grid(uv, battery, iTime);
        col = mix3(col, vec3(1.0f, 0.5f, 1.0f), gridVal);
      } else {
        float fujiD = fminf(uv.y * 4.5f - 0.5f, 1.0f);
        uv.y -= battery * 1.1f - 0.51f;

        vec2 sunUV = uv;
        vec2 fujiUV = uv;

        // Sun
        sunUV = sunUV + vec2(0.75f, 0.2f);
        col = vec3(1.0f, 0.2f, 1.0f);
        float sunVal = sun(sunUV, battery, iTime);

        col = mix3(col, vec3(1.0f, 0.4f, 0.1f), sunUV.y * 2.0f + 0.2f);
        col = mix3(vec3(0.0f), col, sunVal);

        // Fuji mountain
        float fujiVal = sdTrapezoid(
          uv + vec2(-0.75f + sunUV.y * 0.0f, 0.5f),
          1.75f + powf(uv.y * uv.y, 2.1f), 0.2f, 0.5f);
        float waveVal = uv.y + sinf(uv.x * 20.0f + iTime * 2.0f) * 0.05f + 0.2f;
        float wave_width = smoothstep(0.0f, 0.01f, waveVal);

        // Fuji color
        col = mix3(col, mix3(vec3(0.0f, 0.0f, 0.25f), vec3(1.0f, 0.0f, 0.5f), fujiD), step(fujiVal, 0.0f));
        // Fuji top snow
        col = mix3(col, vec3(1.0f, 0.5f, 1.0f), wave_width * step(fujiVal, 0.0f));
        // Fuji outline
        col = mix3(col, vec3(1.0f, 0.5f, 1.0f), 1.0f - smoothstep(0.0f, 0.01f, fabsf(fujiVal)));

        // Horizon color
        col = col + mix3(col, mix3(vec3(1.0f, 0.12f, 0.8f), vec3(0.0f, 0.0f, 0.2f),
          clampf(uv.y * 3.5f + 3.0f, 0.0f, 1.0f)), step(0.0f, fujiVal));

        // Clouds
        vec2 cloudUV = uv;
        cloudUV.x = fmodf(cloudUV.x + iTime * 0.1f, 4.0f) - 2.0f;
        // Handle negative fmod
        if (cloudUV.x < -2.0f) cloudUV.x += 4.0f;
        float cloudTime = iTime * 0.5f;
        float cloudY = -0.5f;

        float cloudVal1 = sdCloud(cloudUV,
          vec2(0.1f + sinf(cloudTime + 140.5f) * 0.1f, cloudY),
          vec2(1.05f + cosf(cloudTime * 0.9f - 36.56f) * 0.1f, cloudY),
          vec2(0.2f + cosf(cloudTime * 0.867f + 387.165f) * 0.1f, 0.25f + cloudY),
          vec2(0.5f + cosf(cloudTime * 0.9675f - 15.162f) * 0.09f, 0.25f + cloudY),
          0.075f);

        cloudY = -0.6f;
        float cloudVal2 = sdCloud(cloudUV,
          vec2(-0.9f + cosf(cloudTime * 1.02f + 541.75f) * 0.1f, cloudY),
          vec2(-0.5f + sinf(cloudTime * 0.9f - 316.56f) * 0.1f, cloudY),
          vec2(-1.5f + cosf(cloudTime * 0.867f + 37.165f) * 0.1f, 0.25f + cloudY),
          vec2(-0.6f + sinf(cloudTime * 0.9675f + 665.162f) * 0.09f, 0.25f + cloudY),
          0.075f);

        float cloudVal = fminf(cloudVal1, cloudVal2);
        col = mix3(col, vec3(0.0f, 0.0f, 0.2f), 1.0f - smoothstep(0.075f - 0.0001f, 0.075f, cloudVal));
        col = col + vec3(1.0f) * (1.0f - smoothstep(0.0f, 0.01f, fabsf(cloudVal - 0.075f)));
      }

      col = col + vec3(fog * fog * fog);
      col = mix3(vec3(col.r * 0.5f), col, battery * 0.7f);

      // Clamp and convert to 8-bit color
      uint8_t r = (uint8_t)(clampf(col.r, 0.0f, 1.0f) * 255.0f);
      uint8_t g = (uint8_t)(clampf(col.g, 0.0f, 1.0f) * 255.0f);
      uint8_t b = (uint8_t)(clampf(col.b, 0.0f, 1.0f) * 255.0f);

      rgb24 pixel = {r, g, b};
      backgroundLayer.drawPixel(px, py, pixel);
    }
  }
}

void setup() {
  Serial.begin(115200);
  matrix.addLayer(&backgroundLayer);
  matrix.begin();
  delay(1000);

  matrix.setBrightness(128);
  Serial.println("Synthwave shader starting...");
}

void loop() {
  float iTime = millis() / 1000.0f;

  renderFrame(iTime);
  backgroundLayer.swapBuffers();
}
