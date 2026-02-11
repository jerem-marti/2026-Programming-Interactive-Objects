/**
 * Serial RGB Client — Firmware for 32×32 HUB75 LED Matrix
 *
 * Receives pixel data over USB serial and displays it on the matrix.
 *
 * Protocol (from host):
 *   Byte 0      : '*' (0x2A) — start-of-frame marker
 *   Bytes 1–2048: 16-bit RGB565 pixel data, big-endian, row-major
 *
 * Hardware: ESP32 + PicoDriver v5 + SmartMatrix (Kameeno fork)
 */

#include "common/pico_driver_v5_pinout.h"

#include <Arduino.h>
#include <SmartMatrix.h>

// ─── Matrix configuration ────────────────────────────────────────────────────
#define COLOR_DEPTH   24
#define TOTAL_WIDTH   32
#define TOTAL_HEIGHT  32
#define kRefreshDepth 24
#define kDmaBufferRows 4
#define kPanelType    SM_PANELTYPE_HUB75_32ROW_32COL_MOD8SCAN
#define kMatrixOptions  (SM_HUB75_OPTIONS_NONE)
#define kbgOptions      (SM_BACKGROUND_OPTIONS_NONE)

SMARTMATRIX_ALLOCATE_BUFFERS(matrix, TOTAL_WIDTH, TOTAL_HEIGHT, kRefreshDepth, kDmaBufferRows, kPanelType, kMatrixOptions);
SMARTMATRIX_ALLOCATE_BACKGROUND_LAYER(bg, TOTAL_WIDTH, TOTAL_HEIGHT, COLOR_DEPTH, kbgOptions);

// ─── Serial protocol ────────────────────────────────────────────────────────
const uint8_t  INCOMING_COLOR_DEPTH = 16;
const uint16_t NUM_LEDS    = TOTAL_WIDTH * TOTAL_HEIGHT;
const uint16_t BUFFER_SIZE = NUM_LEDS * (INCOMING_COLOR_DEPTH / 8);
uint8_t buf[BUFFER_SIZE];

void setup() {
	Serial.begin(921600);
	Serial.setTimeout(1);

	pinMode(PICO_LED_PIN, OUTPUT);
	digitalWrite(PICO_LED_PIN, HIGH);

	bg.enableColorCorrection(true);
	matrix.addLayer(&bg);
	matrix.setBrightness(255);
	matrix.begin();
}

void loop() {
	static uint32_t frame = 0;

	char chr = Serial.read();

	if (chr == '*') {
		uint16_t count = Serial.readBytes((char *)buf, BUFFER_SIZE);

		if (count == BUFFER_SIZE) {
			rgb24 *buffer = bg.backBuffer();

			for (uint16_t i = 0; i < NUM_LEDS; i++) {
				rgb24 *col  = &buffer[i];
				uint16_t idx = i * 2;

				uint8_t  high  = buf[idx];
				uint8_t  low   = buf[idx + 1];
				uint16_t rgb16 = ((uint16_t)high << 8) | low;

				col->red   = ((rgb16 >> 11) & 0x1F) << 3;
				col->green = ((rgb16 >> 5)  & 0x3F) << 2;
				col->blue  = ( rgb16        & 0x1F) << 3;
			}

			bg.swapBuffers(false);
		}
	}

	// Blink onboard LED as heartbeat
	digitalWrite(PICO_LED_PIN, (frame / 20) % 2);
	frame++;
}
