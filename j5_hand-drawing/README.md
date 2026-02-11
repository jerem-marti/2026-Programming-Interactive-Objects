# Hand Drawing — 32×32 LED Matrix

Draw in the air with your finger and see the result on a 32×32 RGB LED matrix. Uses **MediaPipe Hand Landmarker** for real-time hand tracking and **Web Serial API** to stream pixel data to the hardware.

## How it works

1. The webcam captures your hand via the browser
2. MediaPipe detects the **index finger tip** (landmark 8) each frame
3. The finger position is mapped to a 32×32 pixel grid
4. Drawn pixels **fade out** over a configurable timeout (default 5 s)
5. The canvas is sent to the LED matrix via serial at ~60 fps

## Project structure

```
j5_hand-drawing/
├── index.html              # Main webpage
├── js/
│   ├── app.js              # Application orchestrator
│   ├── hand.js             # MediaPipe hand tracking module
│   ├── drawing.js          # 32×32 drawing canvas with fading
│   └── serial.js           # Web Serial API (RGB565 protocol)
└── firmware/
    ├── platformio.ini      # PlatformIO config (ESP32)
    └── src/
        ├── main.cpp        # Serial RGB client for SmartMatrix
        └── common/
            └── pico_driver_v5_pinout.h
```

## Webpage usage

1. Open `index.html` in **Chrome** (Web Serial requires Chromium-based browser)
2. Wait for the hand model to load
3. Click **Start Tracking** to enable camera + hand detection
4. Move your index finger — the trail appears on the matrix preview
5. Adjust **Brush Color**, **Brush Size**, and **Fade Timeout** as desired
6. Click **Connect Serial** to stream to the LED matrix

> **Note:** The page must be served over HTTPS or localhost for camera and serial access. Use a local dev server (e.g. `npx serve` or VS Code Live Server).

## Firmware

The firmware is a standard serial RGB client identical to `x1_serial_rgb_client`. Flash it to the ESP32 via PlatformIO:

```bash
cd firmware
pio run -t upload
```

## Serial protocol

- Baud rate: **921 600**
- Frame: `'*'` (0x2A) + 2 048 bytes of **RGB565** pixel data (32×32 × 2 bytes)
