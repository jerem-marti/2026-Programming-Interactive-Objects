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

PGraphics led;

ArrayList<PImage>images;

int indice = 0;

void setup() {
  size(400, 400);

  images = new ArrayList<PImage>();

  for (int i=0; i<15; i++) {
    images.add(loadImage("s1/" + nf(i, 2) + ".png"));
  }

  // Disable anti-aliasing
  noSmooth();

  led = createGraphics(TOTAL_WIDTH, TOTAL_HEIGHT);
  //led.smooth(8);
  led.noSmooth();

  buffer = new byte[TOTAL_WIDTH * TOTAL_HEIGHT * (COLOR_DEPTH / 8)];

  String[] list = Serial.list();
  printArray(list);

  try {
    // On macOS / Linux see the console for all wavailable ports
    final String PORT_NAME = "/dev/cu.usbserial-02B3ACDB";
    // On Windows the ports are numbered
    // final String PORT_NAME = "COM3";
    serial = new Serial(this, PORT_NAME, BAUD_RATE);
  }
  catch (Exception e) {
    println("Serial port not intialized...");
  }

  led.beginDraw();
  led.background(0);
  led.stroke(255);
  led.strokeWeight(1);
  led.endDraw();
}

void keyPressed() {
  if (key == 'x') {
    led.beginDraw();
    led.background(0);
    led.endDraw();
  } else if (key == 's') {
    //String fileName = "Matrix_" + year() + "_" + month() + "_" + day() + "_" + hour() + "_" + minute() + "_" + second();
    String fileName = "Matrix_" + System.currentTimeMillis();
    // We provide an extension
    led.save("out/" + fileName + ".png");
  } else if (key == 'r') {
    led.beginDraw();
    led.stroke(random(255), random(255), random(255));
    led.endDraw();
  } else if (keyCode == RIGHT) {
    led.beginDraw();
    led.image(images.get(indice), 0, 0);
    led.endDraw();
    indice = (indice + 1) % images.size();
  }
}

void draw() {

  int previewOffsetX = 16;
  int previewOffsetY = 16;
  int previewScale = 10;

  led.beginDraw();
  if (mousePressed) {
    int ax = (mouseX - previewOffsetX) / previewScale;
    int ay = (mouseY - previewOffsetY) / previewScale;
    int bx = (pmouseX - previewOffsetX) / previewScale;
    int by = (pmouseY - previewOffsetY) / previewScale;

    led.line(ax, ay, bx, by);
  }
  led.endDraw();

  background(100, 100, 100);
  image(led, previewOffsetX, previewOffsetY, TOTAL_WIDTH * previewScale, TOTAL_HEIGHT * previewScale);
  image(led, TOTAL_WIDTH * previewScale + previewOffsetX * 2, previewOffsetY);


  // --------------------------------------------------------------------------
  // Write to the serial port (if open)
  if (serial != null) {
    led.loadPixels();
    int idx = 0;
    if (COLOR_DEPTH == 24) {
      for (int i=0; i<led.pixels.length; i++) {
        color c = led.pixels[i];
        buffer[idx++] = (byte)(c >> 16 & 0xFF); // r
        buffer[idx++] = (byte)(c >> 8 & 0xFF);  // g
        buffer[idx++] = (byte)(c & 0xFF);       // b
      }
    } else if (COLOR_DEPTH == 16) {
      for (int i=0; i<led.pixels.length; i++) {
        color c = led.pixels[i];
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
