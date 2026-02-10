# j4_dithered-portrait

Dithered portrait display for the 32×32 RGB LED matrix using Floyd-Steinberg error diffusion.

## Overview

A web-based tool that captures portraits (via webcam or file upload), applies **Floyd-Steinberg error diffusion dithering** to reduce them to the RGB565 color palette, and sends the result to a 32×32 HUB75 LED matrix via Web Serial.

## Why Floyd-Steinberg?

For a 32×32 pixel display with RGB565 color depth (32 red levels, 64 green, 32 blue), simple quantization produces visible color banding. Floyd-Steinberg error diffusion distributes quantization error to neighboring pixels, producing the illusion of more colors and much smoother gradients — critical for recognizable portraits at this resolution.

```
Error distribution pattern:

            pixel   7/16
    3/16    5/16    1/16
```

## Project Structure

```
j4_dithered-portrait/
├── index.html              ← Main webpage (open in Chrome)
├── js/
│   ├── app.js              ← Application orchestration & UI
│   ├── serial.js           ← Web Serial API communication
│   ├── dither.js           ← Floyd-Steinberg dithering engine
│   └── camera.js           ← Webcam capture & image loading
├── firmware/
│   ├── platformio.ini      ← PlatformIO config (ESP32 + SmartMatrix)
│   └── src/
│       ├── main.cpp         ← Serial RGB client firmware
│       └── common/
│           └── pico_driver_v5_pinout.h
└── README.md
```

## Usage

### 1. Flash the firmware

Open `firmware/` in PlatformIO and upload to the ESP32 with the PicoDriver v5 board.

### 2. Open the webpage

Open `index.html` in **Google Chrome** (Web Serial API is Chrome-only).

> **Note:** The page must be served over HTTPS or localhost for camera access.  
> You can use a simple local server: `npx serve .` or Python's `python -m http.server`.

### 3. Workflow

1. **Connect Serial** — click to select the ESP32 serial port (921600 baud)
2. **Start Camera** — enable webcam for portrait capture
3. **Capture** — take a single frame, or use **Live Mode** for continuous streaming
4. Alternatively, **load an image** file
5. Adjust **Grayscale** and **Strength** (error diffusion intensity)
6. **Send to Matrix** — push the dithered image to the LED panel

## Serial Protocol

Same protocol as `h1_send_html_canvas` and `x1_serial_rgb_client`:

| Byte | Content |
|------|---------|
| 0    | `*` (0x2A) — magic header |
| 1–2048 | RGB565 pixel data (32×32 × 2 bytes) |

RGB565 encoding: `RRRRRGGG GGGBBBBB` (big-endian, high byte first).

## Dependencies

- **Firmware:** [SmartMatrix (Kameeno fork)](https://github.com/Kameeno/SmartMatrix)
- **Webpage:** None (vanilla JS, ES modules)
- **Browser:** Chrome 89+ (Web Serial API)
