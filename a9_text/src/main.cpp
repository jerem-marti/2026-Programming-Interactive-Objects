/**
 * Small example that uses the built in font of the SmartMatrix libray.
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
#include "common/pico_driver_v5_pinout.h"

#include <Arduino.h>
#include <SmartMatrix.h>

#define COLOR_DEPTH 24   // valid: 24, 48
#define TOTAL_WIDTH 32   // Size of the total (chained) with of the matrix/matrices
#define TOTAL_HEIGHT 32  // Size of the total (chained) height of the matrix/matrices
#define kRefreshDepth 24 // Valid: 24, 36, 48
#define kDmaBufferRows 4 // Valid: 2-4
#define kPanelType SM_PANELTYPE_HUB75_32ROW_32COL_MOD8SCAN // custom
#define kMatrixOptions (SM_HUB75_OPTIONS_NONE)
#define kbgOptions (SM_BACKGROUND_OPTIONS_NONE)

// SmartMatrix setup & buffer alloction
SMARTMATRIX_ALLOCATE_BUFFERS(matrix, TOTAL_WIDTH, TOTAL_HEIGHT, kRefreshDepth, kDmaBufferRows, kPanelType, kMatrixOptions);

// A single background layer "bg"
SMARTMATRIX_ALLOCATE_BACKGROUND_LAYER(bg, TOTAL_WIDTH, TOTAL_HEIGHT, COLOR_DEPTH, kbgOptions);

void setup() {
	// On board LED (useful for debugging)
	pinMode(PICO_LED_PIN, OUTPUT);

	// Turn the on board LED on
	digitalWrite(PICO_LED_PIN, 1);

	bg.enableColorCorrection(true);
	matrix.addLayer(&bg);
	matrix.setBrightness(255);

	// Init the library and the matrix
	matrix.begin();
}

int frame = 0;
void loop() {

	bg.fillScreen({0, 0, 0});
	bg.setFont(font3x5);
	// bg.setFont(font5x7);
	// bg.setFont(font6x10);
	// bg.setFont(font8x13);
	// bg.setFont(gohufont11);
	// bg.setFont(gohufont11b);	
	for (int i=0; i<5; i++) {
		int x = sin(frame * 0.03 + ((float) i * PI) / 5.0) * TOTAL_WIDTH / 2;
		bg.drawString(x, i * 6 + 1, {255, 0, 0}, "HELLO");
	}
	bg.swapBuffers(false);

	frame++;

}