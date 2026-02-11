/**
 * LIS3DHTR - 3 axis accelerometer and temperature sensor.
 *
 * Connection:
 * VCC <-> 5V
 * GND <-> GND
 * SDA <-> 23
 * SCL <-> 2
 */

#include <Arduino.h>
#include <Wire.h>
#include "LIS3DHTR.h"

#define WIRE Wire
#define I2C_SDA 23
#define I2C_SCL 2

LIS3DHTR<TwoWire> LIS;

void setup() {
	Serial.begin(9600);

	Wire.begin(I2C_SDA, I2C_SCL);

	LIS.begin(Wire, LIS3DHTR_ADDRESS_UPDATED); //IIC init

	if (!LIS) {
		while(true) {
			Serial.println("Error initializing LIS3DHTR.");
			delay(1000);
		}
	}
	Serial.println("LIS3DHTR initialized.");

	LIS.setOutputDataRate(LIS3DHTR_DATARATE_50HZ);
	LIS.setHighSolution(true);
}

void loop() {

	Serial.print("x:"); Serial.println(LIS.getAccelerationX());
	Serial.print("y:"); Serial.println(LIS.getAccelerationY());
	Serial.print("z:"); Serial.println(LIS.getAccelerationZ());

	delay(100);
}
