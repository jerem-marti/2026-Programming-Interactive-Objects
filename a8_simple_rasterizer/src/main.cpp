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

float clamp(float v, float min, float max) {
	if (v < min) return min;
	if (v > max) return max;
	return v;
}

float mix(float x, float y, float a) {
	return x * (1.0 - a) + y * a;
}

// https://iquilezles.org/articles/distfunctions/
float opSmoothUnion( float d1, float d2, float k ) {
    float h = clamp( 0.5 + 0.5*(d2-d1)/k, 0.0, 1.0 );
    return mix( d2, d1, h ) - k*h*(1.0-h);
}


int frame = 0;

void loop() {


	// calculate an offset (-1 to 1), based on "time" (frame)
	float cx1 = sin((float) frame * 0.034);
	float cy1 = cos((float) frame * 0.048);

	float cx2 = sin((float) frame * 0.059 + PI);
	float cy2 = cos((float) frame * 0.063 + PI) ;

	for (int j=0; j<TOTAL_HEIGHT; j++) {
		for (int i=0; i<TOTAL_WIDTH; i++) {

			// normalized coordinates of the pixels: 
			// instead of 0 to 31 we have -1.0 to 1.0			
			float x = (float) i / (TOTAL_WIDTH - 1) * 2.0 - 1.0;
			float y = (float) j / (TOTAL_HEIGHT - 1) * 2.0 - 1.0;
			
			// add some offset 
			float x1 = x + cx1;
			float y1 = y + cy1;

			float x2 = x + cx2;
			float y2 = y + cy2;
						
			float d1 = sqrt( x1 * x1 + y1 * y1) - 0.2;
			float d2 = sqrt( x2 * x2 + y2 * y2) - 0.4;
			
			float d = opSmoothUnion(d1, d2, 0.8);

			int gray = (sin(d * 20.0 - frame * 0.5) * 0.5 + 0.5) * 255.0;
			bg.drawPixel(i, j, {gray, 0, 0});
		}
	}

	bg.swapBuffers();
	frame++;
}