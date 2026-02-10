/**
 * Control a single LED of a RGB matrix, directly from the controller.
 *
 * The SmartMatrix library offers many tools (and examples) to display graphics,
 * animations and texts.
 * Dependencies (and docs):
 * https://github.com/pixelmatix/SmartMatrix
 *
 * Fork of the library that allows control of the special 32x32 matrix
 * https://github.com/Kameeno/SmartMatrix
 */

// Pinout configuration for the PicoDriver v.5.0
#include "pico_driver_v5_pinout.h"
#define USE_ADAFRUIT_GFX_LAYERS

#include <Arduino.h>
#include <SmartMatrix.h>
#include "gimpbitmap.h"
#include "bitmap/luca.c"

#define COLOR_DEPTH 24   // valid: 24, 48
#define TOTAL_WIDTH 32   // Size of the total (chained) with of the matrix/matrices
#define TOTAL_HEIGHT 32  // Size of the total (chained) height of the matrix/matrices
#define kRefreshDepth 24 // Valid: 24, 36, 48
#define kDmaBufferRows 4 // Valid: 2-4
#define kPanelType SM_PANELTYPE_HUB75_32ROW_32COL_MOD8SCAN // custom
#define kMatrixOptions (SM_HUB75_OPTIONS_NONE)
#define kBackgroundLayerOptions (SM_BACKGROUND_OPTIONS_NONE)

// SmartMatrix setup & buffer alloction
SMARTMATRIX_ALLOCATE_BUFFERS(matrix, TOTAL_WIDTH, TOTAL_HEIGHT, kRefreshDepth, kDmaBufferRows, kPanelType, kMatrixOptions);

// A single background layer "backgroundLayer"
SMARTMATRIX_ALLOCATE_BACKGROUND_LAYER(backgroundLayer, TOTAL_WIDTH, TOTAL_HEIGHT, COLOR_DEPTH, kBackgroundLayerOptions);

// Assign human-readable names to some common 16-bit color values:
#define BLACK   0x0000
#define BLUE    0x001F
#define RED     0xF800
#define GREEN   0x07E0
#define CYAN    0x07FF
#define MAGENTA 0xF81F
#define YELLOW  0xFFE0
#define WHITE   0xFFFF

// enable this to see the intermediate drawing steps, otherwise screen will only be updated at the end of each test (this slows the tests down considerably)
const bool swapAfterEveryDraw = false;

// Draw any GIMP C-source bitmap (supports RGB and RGBA)
void drawBitmapRGB(int16_t x, int16_t y, const unsigned char* pixel_data, int16_t w, int16_t h, int bpp = 3) {
  for (int16_t i = 0; i < h; i++) {
    for (int16_t j = 0; j < w; j++) {
      rgb24 pixel = {
        pixel_data[(i * w + j) * bpp + 0],
        pixel_data[(i * w + j) * bpp + 1],
        pixel_data[(i * w + j) * bpp + 2]
      };
      backgroundLayer.drawPixel(x + j, y + i, pixel);
    }
  }
}

// Test bitmap: draws the Chrome 16x16 icon centered on the 32x32 matrix
unsigned long testBitmap() {
  backgroundLayer.fillScreen(BLACK);
  unsigned long start = micros();
  // Center the 16x16 bitmap on the 32x32 matrix
  drawBitmapRGB(0, 0, (const unsigned char*)luca.pixel_data, luca.width, luca.height, luca.bytes_per_pixel);
  return micros() - start;
}

unsigned long testFillScreen() {
  unsigned long start = micros();
  backgroundLayer.fillScreen(BLACK);
  backgroundLayer.fillScreen(RED);
  backgroundLayer.fillScreen(GREEN);
  backgroundLayer.fillScreen(BLUE);
  backgroundLayer.fillScreen(BLACK);
  return micros() - start;
}

unsigned long testText() {
  backgroundLayer.fillScreen(BLACK);
  unsigned long start = micros();
  backgroundLayer.setCursor(0, 0);
  backgroundLayer.setTextColor(WHITE);  backgroundLayer.setTextSize(1);
  backgroundLayer.println("Hello!");
  backgroundLayer.setTextColor(YELLOW); backgroundLayer.setTextSize(1);
  backgroundLayer.println("32x32");
  backgroundLayer.setTextColor(RED);    backgroundLayer.setTextSize(1);
  backgroundLayer.println("Matrix");
  backgroundLayer.setTextColor(GREEN); backgroundLayer.setTextSize(2);
  backgroundLayer.println("Test");
  backgroundLayer.setTextColor(CYAN); backgroundLayer.setTextSize(1);
  backgroundLayer.println("Size 1");
  backgroundLayer.println("Fits!");
  return micros() - start;
}

unsigned long testLines(uint16_t color) {
  unsigned long start, t;
  int           x1, y1, x2, y2,
                w = backgroundLayer.width(),
                h = backgroundLayer.height();

  backgroundLayer.fillScreen(BLACK);

  x1 = y1 = 0;
  y2    = h - 1;
  start = micros();
  for(x2=0; x2<w; x2+=6) {
    backgroundLayer.drawLine(x1, y1, x2, y2, color);
    if(swapAfterEveryDraw) backgroundLayer.swapBuffers();
  }
  x2    = w - 1;
  for(y2=0; y2<h; y2+=6) {
    backgroundLayer.drawLine(x1, y1, x2, y2, color);
    if(swapAfterEveryDraw) backgroundLayer.swapBuffers();
  }
  t     = micros() - start; // fillScreen doesn't count against timing
  backgroundLayer.swapBuffers();

  backgroundLayer.fillScreen(BLACK);

  x1    = w - 1;
  y1    = 0;
  y2    = h - 1;
  start = micros();
  for(x2=0; x2<w; x2+=6) {
    backgroundLayer.drawLine(x1, y1, x2, y2, color);
    if(swapAfterEveryDraw) backgroundLayer.swapBuffers();
  }
  x2    = 0;
  for(y2=0; y2<h; y2+=6) {
    backgroundLayer.drawLine(x1, y1, x2, y2, color);
    if(swapAfterEveryDraw) backgroundLayer.swapBuffers();
  }
  t    += micros() - start;
  backgroundLayer.swapBuffers();

  backgroundLayer.fillScreen(BLACK);

  x1    = 0;
  y1    = h - 1;
  y2    = 0;
  start = micros();
  for(x2=0; x2<w; x2+=6) {
    backgroundLayer.drawLine(x1, y1, x2, y2, color);
    if(swapAfterEveryDraw) backgroundLayer.swapBuffers();
  }
  x2    = w - 1;
  for(y2=0; y2<h; y2+=6) {
    backgroundLayer.drawLine(x1, y1, x2, y2, color);
    if(swapAfterEveryDraw) backgroundLayer.swapBuffers();
  }
  t    += micros() - start;
  backgroundLayer.swapBuffers();

  backgroundLayer.fillScreen(BLACK);

  x1    = w - 1;
  y1    = h - 1;
  y2    = 0;
  start = micros();
  for(x2=0; x2<w; x2+=6) {
    backgroundLayer.drawLine(x1, y1, x2, y2, color);
    if(swapAfterEveryDraw) backgroundLayer.swapBuffers();
  }
  x2    = 0;
  for(y2=0; y2<h; y2+=6) {
    backgroundLayer.drawLine(x1, y1, x2, y2, color);
    if(swapAfterEveryDraw) backgroundLayer.swapBuffers();
  }
  t    += micros() - start;
  backgroundLayer.swapBuffers();

  return t;
}
unsigned long testFastLines(uint16_t color1, uint16_t color2) {
  unsigned long start;
  int           x, y, w = backgroundLayer.width(), h = backgroundLayer.height();

  backgroundLayer.fillScreen(BLACK);
  start = micros();
  for(y=0; y<h; y+=5) {
    backgroundLayer.drawFastHLine(0, y, w, color1);
    if(swapAfterEveryDraw) backgroundLayer.swapBuffers();
  }
  for(x=0; x<w; x+=5) {
    backgroundLayer.drawFastVLine(x, 0, h, color2);
    if(swapAfterEveryDraw) backgroundLayer.swapBuffers();
  }

  return micros() - start;
}

unsigned long testRects(uint16_t color) {
  unsigned long start;
  int           n, i, i2,
                cx = backgroundLayer.width()  / 2,
                cy = backgroundLayer.height() / 2;

  backgroundLayer.fillScreen(BLACK);
  n     = min(backgroundLayer.width(), backgroundLayer.height());
  start = micros();
  for(i=2; i<n; i+=6) {
    i2 = i / 2;
    backgroundLayer.drawRect(cx-i2, cy-i2, i, i, color);
    if(swapAfterEveryDraw) backgroundLayer.swapBuffers();
  }

  return micros() - start;
}

unsigned long testFilledRects(uint16_t color1, uint16_t color2) {
  unsigned long start, t = 0;
  int           n, i, i2,
                cx = backgroundLayer.width()  / 2 - 1,
                cy = backgroundLayer.height() / 2 - 1;

  backgroundLayer.fillScreen(BLACK);
  n = min(backgroundLayer.width(), backgroundLayer.height());
  for(i=n; i>0; i-=6) {
    i2    = i / 2;
    start = micros();
    backgroundLayer.fillRect(cx-i2, cy-i2, i, i, color1);
    if(swapAfterEveryDraw) backgroundLayer.swapBuffers();
    t    += micros() - start;
    // Outlines are not included in timing results
    backgroundLayer.drawRect(cx-i2, cy-i2, i, i, color2);
    if(swapAfterEveryDraw) backgroundLayer.swapBuffers();
  }

  return t;
}

unsigned long testFilledCircles(uint8_t radius, uint16_t color) {
  unsigned long start;
  int x, y, w = backgroundLayer.width(), h = backgroundLayer.height(), r2 = radius * 2;

  backgroundLayer.fillScreen(BLACK);
  start = micros();
  for(x=radius; x<w; x+=r2) {
    for(y=radius; y<h; y+=r2) {
      backgroundLayer.fillCircle(x, y, radius, color);
      if(swapAfterEveryDraw) backgroundLayer.swapBuffers();
    }
  }

  return micros() - start;
}

unsigned long testCircles(uint8_t radius, uint16_t color) {
  unsigned long start;
  int           x, y, r2 = radius * 2,
                w = backgroundLayer.width()  + radius,
                h = backgroundLayer.height() + radius;

  // Screen is not cleared for this one -- this is
  // intentional and does not affect the reported time.
  start = micros();
  for(x=0; x<w; x+=r2) {
    for(y=0; y<h; y+=r2) {
      backgroundLayer.drawCircle(x, y, radius, color);
      if(swapAfterEveryDraw) backgroundLayer.swapBuffers();
    }
  }

  return micros() - start;
}

unsigned long testTriangles() {
  unsigned long start;
  int           n, i, cx = backgroundLayer.width()  / 2 - 1,
                      cy = backgroundLayer.height() / 2 - 1;

  backgroundLayer.fillScreen(BLACK);
  n     = min(cx, cy);
  start = micros();
  for(i=0; i<n; i+=5) {
    backgroundLayer.drawTriangle(
      cx    , cy - i, // peak
      cx - i, cy + i, // bottom left
      cx + i, cy + i, // bottom right
      backgroundLayer.color565(0, 0, i));
    if(swapAfterEveryDraw) backgroundLayer.swapBuffers();
  }

  return micros() - start;
}

unsigned long testFilledTriangles() {
  unsigned long start, t = 0;
  int           i, cx = backgroundLayer.width()  / 2 - 1,
                   cy = backgroundLayer.height() / 2 - 1;

  backgroundLayer.fillScreen(BLACK);
  start = micros();
  for(i=min(cx,cy); i>10; i-=5) {
    start = micros();
    backgroundLayer.fillTriangle(cx, cy - i, cx - i, cy + i, cx + i, cy + i,
      backgroundLayer.color565(0, i, i));
    t += micros() - start;
    if(swapAfterEveryDraw) backgroundLayer.swapBuffers();
    backgroundLayer.drawTriangle(cx, cy - i, cx - i, cy + i, cx + i, cy + i,
      backgroundLayer.color565(i, i, 0));
    if(swapAfterEveryDraw) backgroundLayer.swapBuffers();
  }

  return t;
}

unsigned long testRoundRects() {
  unsigned long start;
  int           w, i, i2,
                cx = backgroundLayer.width()  / 2 - 1,
                cy = backgroundLayer.height() / 2 - 1;

  backgroundLayer.fillScreen(BLACK);
  w     = min(backgroundLayer.width(), backgroundLayer.height());
  start = micros();
  for(i=0; i<w; i+=6) {
    i2 = i / 2;
    backgroundLayer.drawRoundRect(cx-i2, cy-i2, i, i, i/8, backgroundLayer.color565(i, 0, 0));
    if(swapAfterEveryDraw) backgroundLayer.swapBuffers();
  }

  return micros() - start;
}

unsigned long testFilledRoundRects() {
  unsigned long start;
  int           i, i2,
                cx = backgroundLayer.width()  / 2 - 1,
                cy = backgroundLayer.height() / 2 - 1;

  backgroundLayer.fillScreen(BLACK);
  start = micros();
  for(i=min(backgroundLayer.width(), backgroundLayer.height()); i>20; i-=6) {
    i2 = i / 2;
    backgroundLayer.fillRoundRect(cx-i2, cy-i2, i, i, i/8, backgroundLayer.color565(0, i, 0));
    if(swapAfterEveryDraw) backgroundLayer.swapBuffers();
  }

  return micros() - start;
}

void setup() {
  Serial.begin(115200);
  matrix.addLayer(&backgroundLayer); 
  matrix.begin();

  // wait for Serial to be ready
  delay(1000);

  matrix.setBrightness(128);

  Serial.println(F("Benchmark                Time (microseconds)"));

  Serial.print(F("Screen fill              "));
  Serial.println(testFillScreen());
  backgroundLayer.swapBuffers();
  delay(500);

  Serial.print(F("Text                     "));
  Serial.println(testText());
  backgroundLayer.swapBuffers();
  delay(3000);

  Serial.print(F("Lines                    "));
  Serial.println(testLines(CYAN));
  backgroundLayer.swapBuffers();
  delay(500);

  Serial.print(F("Horiz/Vert Lines         "));
  Serial.println(testFastLines(RED, BLUE));
  backgroundLayer.swapBuffers();
  delay(500);

  Serial.print(F("Rectangles (outline)     "));
  Serial.println(testRects(GREEN));
  backgroundLayer.swapBuffers();
  delay(500);

  Serial.print(F("Rectangles (filled)      "));
  Serial.println(testFilledRects(YELLOW, MAGENTA));
  backgroundLayer.swapBuffers();
  delay(500);

  Serial.print(F("Circles (filled)         "));
  Serial.println(testFilledCircles(10, MAGENTA));
  backgroundLayer.swapBuffers();
  delay(500);

  Serial.print(F("Circles (outline)        "));
  Serial.println(testCircles(10, WHITE));
  backgroundLayer.swapBuffers();
  delay(500);

  Serial.print(F("Triangles (outline)      "));
  Serial.println(testTriangles());
  backgroundLayer.swapBuffers();
  delay(500);

  Serial.print(F("Triangles (filled)       "));
  Serial.println(testFilledTriangles());
  backgroundLayer.swapBuffers();
  delay(500);

  Serial.print(F("Rounded rects (outline)  "));
  Serial.println(testRoundRects());
  backgroundLayer.swapBuffers();
  delay(500);

  Serial.print(F("Rounded rects (filled)   "));
  Serial.println(testFilledRoundRects());
  backgroundLayer.swapBuffers();
  delay(500);

  Serial.print(F("Bitmap                   "));
  Serial.println(testBitmap());
  backgroundLayer.swapBuffers();
  delay(3000);

  Serial.println(F("Done!"));
}

void loop() {
}