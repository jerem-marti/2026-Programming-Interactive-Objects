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

	// Init the library and the matrix
	matrix.begin();

}


int frame = 0;

void loop() {


	// calculate an offset (-1 to 1), based on "time" (frame)
	float cx = sin((float) frame * 0.014);
	float cy = cos((float) frame * 0.018);

	for (int j=0; j<TOTAL_HEIGHT; j++) {
		for (int i=0; i<TOTAL_WIDTH; i++) {

			// normalized coordinates of the pixels: 
			// instead of 0 to 31 we have -1.0 to 1.0			
			float x = (float) i / (TOTAL_WIDTH - 1) * 2.0 - 1.0;
			float y = (float) j / (TOTAL_HEIGHT - 1) * 2.0 - 1.0;
			
			// add some offset 
			x += cx;
			y += cy;

			float rx = x; 
			float ry = y;

			float gx = x + 0.1;
			float gy = y + 0.1;

			float bx = x - 0.1;
			float by = y + 0.05;

			
			float rd = sqrt( rx * rx + ry * ry);
			float gd = sqrt( gx * gx + gy * gy);
			float bd = sqrt( bx * bx + by * by);
			
			// ...or obtain a "gray" value from the distance plugged into a periodic funtion
			int red   = (sin(rd * 12.0 - frame * 0.42) * 0.5 + 0.5) * 255.0;
			int green = (sin(gd * 12.0 - frame * 0.45) * 0.5 + 0.5) * 255.0;
			int blue  = (sin(bd * 12.0 - frame * 0.47) * 0.5 + 0.5) * 255.0;

			bg.drawPixel(i, j, {red, green, blue});
		}
	}

	bg.swapBuffers();
	frame++;
}