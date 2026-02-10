/**
 * Reading values from LIS3DHTR sensor - 3 axis accelerometer and temperature sensor.
 * Connect the sensor as follows:
 * VCC <-> 5V
 * GND <-> GND
 * SDA <-> 23
 * SCL <-> 2
 */

#include <Arduino.h>
#include "LIS3DHTR.h"
#include <Wire.h>
LIS3DHTR<TwoWire> LIS;

#define WIRE Wire
#define I2C_SDA 23
#define I2C_SCL 2

void setup() {
	Wire.begin(I2C_SDA, I2C_SCL);
	Serial.begin(9600);

	while (!Serial) {};

	LIS.begin(Wire, LIS3DHTR_ADDRESS_UPDATED); //IIC init
	delay(100);
	LIS.setOutputDataRate(LIS3DHTR_DATARATE_50HZ);
	LIS.setHighSolution(true); //High solution enable
}

void loop() {
	if (!LIS) {
		Serial.println("LIS3DHTR didn't connect.");
		return;
	}
	//3 axis
	Serial.print("x:"); Serial.println(LIS.getAccelerationX());
	Serial.print("y:"); Serial.println(LIS.getAccelerationY());
	Serial.print("z:"); Serial.println(LIS.getAccelerationZ());
	delay(10);
}