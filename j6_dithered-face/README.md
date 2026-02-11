# j6_dithered-face

Real-time dithered face mimicry for the 32×32 RGB LED matrix using MediaPipe FaceMesh and Floyd-Steinberg error diffusion.

## Overview

A web app that captures your face via webcam, detects facial landmarks with **MediaPipe FaceMesh** (478 points), and renders a dithered portrait or stylized pixel-art avatar onto a 32×32 HUB75 LED matrix via Web Serial. The pixel-art face **mimics your expressions** in real-time—blinking, mouth opening, eyebrow raises, and head turns are all tracked and reflected.

## Two Render Modes

### 📸 Photo Mode (default)
Crops the webcam feed tightly around your face using the mesh bounding box, scales it to 32×32, and applies Floyd-Steinberg dithering. The face always fills the full matrix surface regardless of distance or position.

### 🎨 Pixel Art Mode
Draws a stylized cartoon face on the 32×32 grid. Expression metrics from the mesh drive the avatar:
- **Eyes**: open / half-closed / closed (blink detection)
- **Mouth**: open/closed, width, smile curve
- **Eyebrows**: raise/lower independently
- **Head**: horizontal/vertical shift follows yaw & pitch

## Project Structure

```
j6_dithered-face/
├── index.html              ← Main webpage (open in Chrome)
├── js/
│   ├── app.js              ← Application orchestration & UI
│   ├── camera.js           ← Webcam stream management
│   ├── faceMesh.js         ← MediaPipe FaceMesh: landmarks + expressions
│   ├── faceRenderer.js     ← Face cropping & pixel-art rendering
│   ├── dither.js           ← Floyd-Steinberg dithering engine
│   └── serial.js           ← Web Serial API communication
└── README.md
```

## Module Responsibilities

| Module | Role |
|--------|------|
| **camera.js** | Start/stop webcam, expose the video element |
| **faceMesh.js** | Load MediaPipe model, detect 478 landmarks, extract expression metrics (eye openness, mouth, brows, head rotation) |
| **faceRenderer.js** | Photo mode: face-aware crop to 32×32. Pixel-art mode: draw stylized face from metrics |
| **dither.js** | Floyd-Steinberg RGB565 error diffusion |
| **serial.js** | Web Serial connection, RGB565 frame transmission |
| **app.js** | Wires everything together, manages UI and live loop |

## Expression Metrics Extracted

From MediaPipe FaceMesh, the following are computed per frame:

- `leftEyeOpen` / `rightEyeOpen` — 0 (closed) to 1 (open)
- `mouthOpen` — vertical mouth aperture (0–1)
- `mouthWidth` — horizontal mouth stretch (0–1)
- `leftBrowRaise` / `rightBrowRaise` — eyebrow lift (0–1)
- `headYaw` / `headPitch` / `headRoll` — head rotation (radians)
- `faceBox` — bounding box for face cropping
- `blendshapes` — full MediaPipe blendshape dictionary (52 values)

## Usage

### 1. Flash the firmware

Use the same ESP32 + SmartMatrix firmware as `j4_dithered-portrait` (serial RGB client in `../j4_dithered-portrait/firmware/`).

### 2. Open the webpage

Open `index.html` in **Google Chrome** (Web Serial + MediaPipe require Chrome).

> Serve over HTTPS or localhost for camera access:
> ```
> npx serve .
> ```
> or
> ```
> python -m http.server
> ```

### 3. Use the interface

1. Click **📷 Start Camera** — webcam starts, model loads, live face tracking begins immediately
2. Switch between **Photo Mode** (dithered webcam crop) and **Pixel Art Mode** (stylized avatar)
3. Toggle **Dithering**, **Grayscale**, adjust **Strength**
4. Enable **Show Mesh** to see the landmark overlay on the video feed
5. Click **Connect Serial** to send frames to the LED matrix in real-time

## Dependencies

All loaded from CDN (no build step required):
- [MediaPipe Tasks Vision](https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision) — FaceLandmarker model + WASM

## Browser Requirements

- **Google Chrome** (Web Serial API + MediaPipe WASM)
- Camera permission
- HTTPS or localhost
