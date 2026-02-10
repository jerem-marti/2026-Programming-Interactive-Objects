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
	Serial.begin(115200);
	while (!Serial)
	{
	};
	LIS.begin(WIRE, 0x19); //IIC init
	delay(100);
	LIS.setOutputDataRate(LIS3DHTR_DATARATE_50HZ);
	LIS.setHighSolution(true); //High solution enable
}

void loop() {
	if (!LIS) {
		Serial.println("LIS3DHTR didn't connect.");
		while (1);
		return;
	}
	//3 axis
		Serial.print("x:"); Serial.print(LIS.getAccelerationX()); Serial.print("  ");
		Serial.print("y:"); Serial.print(LIS.getAccelerationY()); Serial.print("  ");
		Serial.print("z:"); Serial.println(LIS.getAccelerationZ());
	delay(10);
}