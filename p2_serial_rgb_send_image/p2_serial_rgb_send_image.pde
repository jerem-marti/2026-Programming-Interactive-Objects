/**
 * This Processing sketch sends all the pixels of the canvas to the serial port.
 */

import processing.serial.*;

final int TOTAL_WIDTH  = 32;
final int TOTAL_HEIGHT = 32;
final int COLOR_DEPTH  = 16; // 24 or 16 bits
final int BAUD_RATE    = 921600;

Serial serial;
byte[]buffer;

// PImage is Processing's image type
PImage img;

void setup() {
  // The Processing preprocessor only accepts literal values for size()
  // We can't do: size(TOTAL_WIDTH, TOTAL_HEIGHT);
  size(32, 32);
  
  smooth(8);
  
  img = loadImage("cat.jpg");

  buffer = new byte[TOTAL_WIDTH * TOTAL_HEIGHT * (COLOR_DEPTH / 8)];

  String[] list = Serial.list();
  printArray(list);
  
  try {
    // On macOS / Linux see the console for all available ports
    final String PORT_NAME = "/dev/cu.usbserial-02B3ACDB";
    // On Windows the ports are numbered
    // final String PORT_NAME = "COM3";
    serial = new Serial(this, PORT_NAME, BAUD_RATE);
  } catch (Exception e) {
    println("Serial port not intialized...");
  }  
}

void draw() {
   
  float imgSize = map(sin(frameCount * 0.05), -1, 1, 32, 256);
  image(img, width/2-imgSize/2, height/2-imgSize/2, imgSize, imgSize);
  
  // --------------------------------------------------------------------------
  // Write to the serial port (if open)
  if (serial != null) {
    loadPixels();
    int idx = 0;
    if (COLOR_DEPTH == 24) {
      for (int i=0; i<pixels.length; i++) {
        color c = pixels[i];
        buffer[idx++] = (byte)(c >> 16 & 0xFF); // r
        buffer[idx++] = (byte)(c >> 8 & 0xFF);  // g
        buffer[idx++] = (byte)(c & 0xFF);       // b
      }
    } else if (COLOR_DEPTH == 16) {
      for (int i=0; i<pixels.length; i++) {
        color c = pixels[i];
        byte r = (byte)(c >> 16 & 0xFF); // r
        byte g = (byte)(c >> 8 & 0xFF);  // g
        byte b = (byte)(c & 0xFF);       // b
        int rgb24 = packRGB16(r, g, b);
        byte[] bytes = splitBytes(rgb24);
        buffer[idx++] = bytes[0];
        buffer[idx++] = bytes[1];
      }
    }
    serial.write('*');     // The 'data' command
    serial.write(buffer);  // ...and the pixel values
  }
}

// Convert 8-bit RGB values to 5-6-5 bits
// Pack into 16-bit value: RRRRRGGG GGGBBBBB
int packRGB16(byte r, byte g, byte b) {
  byte r5 = (byte)((r >> 3) & 0x1F);  // 5 bits for red
  byte g6 = (byte)((g >> 2) & 0x3F);  // 6 bits for green
  byte b5 = (byte)((b >> 3) & 0x1F);  // 5 bits for blue
  return (r5 << 11) | (g6 << 5) | b5;
}

// Splits a 16 bit int into two bytes
byte[] splitBytes(int int16) {
  byte highByte = (byte)((int16 >> 8) & 0xFF);  // Get upper 8 bits
  byte lowByte  = (byte)(int16 & 0xFF);        // Get lower 8 bits
  return new byte[]{highByte, lowByte};
}
