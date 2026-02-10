/**
 * The controller acts as a client, expecting (pixel) data from the serial port.
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

#include <WiFi.h>
#include <WiFiUdp.h>


/* WiFi network name and password */
const char * ssid = "FabulousNet";
const char * pwd = "25jan2022";

#define UDP_PORT 44444

// IP address to send UDP data to.
// it can be ip address of the server or 
// a network broadcast address
// here is broadcast address
// const char * udpAddress = "192.168.1.100";
// const int udpPort = 44444;

//create UDP instance
WiFiUDP udp;


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


// RGB32 or RGB24 (RRRRRGGG GGGBBBBB)?
const uint8_t INCOMING_COLOR_DEPTH = 16;

const uint16_t NUM_LEDS = TOTAL_WIDTH * TOTAL_HEIGHT;
const uint16_t BUFFER_SIZE = NUM_LEDS * (INCOMING_COLOR_DEPTH / 8);
static uint8_t buf[BUFFER_SIZE] __attribute__((aligned(4))); // Align buffer for better memory access
static uint8_t receivedChunks[8] = {0};

const uint16_t CHUNK_SIZE = 1024;
const uint16_t HEADER_SIZE = 2;   // [currentChunk, totalChunks]

// Add these global variables for FPS calculation
static uint32_t frameCount = 0;
static uint32_t lastFPSUpdate = 0;
static float currentFPS = 0;

// Add these constants at the top with other definitions
#define FPS_UPDATE_INTERVAL 1000  // Update FPS every second
#define LED_BLINK_INTERVAL 500    // LED blink interval in ms

void setup() {
	// Serial.begin(921600);
	// Serial.setTimeout(1); 

	pinMode(PICO_LED_PIN, OUTPUT);
	digitalWrite(PICO_LED_PIN, 1);

	// Serial.begin(115200);

	//Connect to the WiFi network
	WiFi.begin(ssid, pwd);
	// Serial.println("");

	// Add WiFi connection timeout
	uint32_t connectionStart = millis();
	const uint32_t WIFI_TIMEOUT = 20000; // 20 seconds timeout
	
	while (WiFi.status() != WL_CONNECTED) {
		if (millis() - connectionStart > WIFI_TIMEOUT) {
			ESP.restart(); // Restart if cannot connect
		}
		delay(500);
	}
	udp.begin(UDP_PORT);

	// Serial.println("");
	// Serial.print("Connected to ");
	// Serial.println(ssid);
	// Serial.print("IP address: ");
	// Serial.println(WiFi.localIP());
	// Serial.print("Port: ");
	// Serial.println(UDP_PORT);
	// Serial.print("Buffer size: ");
	// Serial.println(BUFFER_SIZE);  // This will show 3072 for 32x32x3

	bg.enableColorCorrection(true);
	matrix.addLayer(&bg);
	matrix.setBrightness(255);
	matrix.begin();
}

// Helper function for RGB conversion
inline void convert16to24bit(const uint8_t high, const uint8_t low, rgb24* col) {
	uint16_t rgb16 = ((uint16_t)high << 8) | low;
	col->red   = ((rgb16 >> 11) & 0x1F) << 3;
	col->green = ((rgb16 >> 5)  & 0x3F) << 2;
	col->blue  = (rgb16 & 0x1F) << 3;
}

void loop() {
	static uint32_t lastLEDBlink = 0;
	int packetSize = udp.parsePacket();
	
	if (packetSize) {
		uint8_t chunkIndex, totalChunks;
		
		// Read header
		udp.read(&chunkIndex, 1);
		udp.read(&totalChunks, 1);

		// Read chunk data
		int dataSize = packetSize - HEADER_SIZE; // Subtract header size
		if (dataSize > 0) {
			// Use memcpy for faster data copy
			udp.read(&buf[chunkIndex * CHUNK_SIZE], dataSize);
			receivedChunks[chunkIndex] = 1;

			bool complete = true;
			for (int i = 0; i < totalChunks && complete; i++) {
				complete = receivedChunks[i];
			}

			if (complete) {
				memset(receivedChunks, 0, sizeof(receivedChunks));
				
				rgb24 *buffer = bg.backBuffer();
				
				if (INCOMING_COLOR_DEPTH == 24) {
					// Use memcpy for 24-bit color
					memcpy(buffer, buf, BUFFER_SIZE);
				} else if (INCOMING_COLOR_DEPTH == 16) {
					uint16_t idx = 0;
					for (uint16_t i = 0; i < NUM_LEDS; i++, idx += 2) {
						convert16to24bit(buf[idx], buf[idx + 1], &buffer[i]);
					}
				}

				

				// Update debug information
				char debugStr[16];
				sprintf(debugStr, "F:%lu", frameCount);
				bg.drawString(0, 0, {255,0,0}, debugStr);
				// sprintf(debugStr, "FPS:%.1f", currentFPS);
				// bg.drawString(0, 14, {255,0,0}, debugStr);

				bg.swapBuffers();

			

			}
		}
	}
	// // Update FPS calculation
	// frameCount++;
	// uint32_t now = millis();
	// if (now - lastFPSUpdate >= FPS_UPDATE_INTERVAL) {
	// 	currentFPS = frameCount * 1000.0f / (now - lastFPSUpdate);
	// 	frameCount = 0;
	// 	lastFPSUpdate = now;
	// }
}