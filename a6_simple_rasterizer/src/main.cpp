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
	matrix.begin();
}

uint frame = 0;

void loop() {

	int cx = 0.0;
	int cy = 0.0;
	float r = 0.75;

	float  t = frame * 0.1;

	for (int j=0; j<TOTAL_HEIGHT; j++) {
		for (int i=0; i<TOTAL_WIDTH; i++) {

			float u = (float)i / (TOTAL_WIDTH - 1) * 2 - 1.0;
			float v = (float)j / (TOTAL_HEIGHT - 1) * 2 - 1.0;

			float dx = cx - u;
			float dy = cy - v;

			float d = sqrt( dx * dx + dy * dy);
			float s = sin(d*8.0 - t) * 0.5 + 0.5;
			float gray = s * 255;

			bg.drawPixel(i, j, {gray, gray, gray});
		}
	}

	bg.swapBuffers();

	frame++;
}