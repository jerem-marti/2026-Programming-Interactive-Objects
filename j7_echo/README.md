# Echo — Send-a-Pixel Ritual

A gesture-only "presence ritual" for a 32×32 RGB LED matrix, built on **3D Signed Distance Fields** rendered via sphere tracing (raymarching) in the browser.

## Concept

The LED matrix shows a **shared living object** — a 3D SDF form (torus, metaball cluster, or rounded box) that slowly breathes and drifts. Gestures don't draw; they **perturb the object**.

A ritual of charging and releasing creates *presence events* — moments of focused attention that become visual traces (scars) embedded in the object. Two devices sharing the same object can exchange these events, creating a felt connection without messaging.

## Interaction States

| State | Trigger | What You See |
|-------|---------|--------------|
| **Idle** | No hand | Object breathes calmly — stable silhouette, micro-drift |
| **Ready** | Hand present | Object "notices" you — contrast up, leans toward hand |
| **Charging** | Pinch held | Core forms inside, surface tightens, energy grows |
| **Release** | Pinch opens | Core crystallizes → bloom → inward shockwave → assimilate |
| **Receiving** | Remote event | Second core appears from afar, travels inward, merges |

### Sync Moment
If both users release within ~30 seconds, the object briefly becomes a **perfect torus** — crisp, symmetric, noise-free — for ~2.5 seconds, then melts back.

## SDF Engine

The raymarcher traces 1024 rays (32×32) per frame against a 3D distance field. At this resolution, full sphere tracing runs comfortably in JavaScript at 25–35 fps.

### Shapes
- **Metaball cluster** — 3 soft blobs with smooth union
- **Torus + sphere** — clean readable silhouette
- **Rounded box** — morphs slowly toward a sphere

### Effects
- **Domain warp** — organic wobble (adjustable)
- **Smooth union/subtraction** — blending and carving
- **Ordered dithering** (Bayer 4×4) — limited LED palette feel
- **Event scars** — fading bubbles/cavities from past releases

## Gesture Features (MediaPipe)

The hand module extracts per-frame (smoothed):
- `handPresent` — boolean
- `handCenter` — normalized x,y (mirrored for selfie)
- `handSpeed` — 0..1
- `openness` — 0..1 (finger extension)
- `pinch` — 0..1 (thumb-index proximity)

## What Gets Transmitted

When a Release happens, only:
- `seed` (int) — shapes the visual identity of the event
- `energy` (0..1) — how charged it was

Receiver uses the seed to spawn and animate the arriving core. Bandwidth is tiny; meaning is ambiguous by design.

## Files

```
j7_echo/
├── index.html       ← Single-page app (HTML + CSS)
├── js/
│   ├── app.js       ← Orchestrator: loop, UI, wiring
│   ├── serial.js    ← Web Serial API (USB → matrix)
│   ├── hand.js      ← MediaPipe hand tracking + gesture features
│   ├── sdf.js       ← 3D SDF raymarching engine
│   └── ritual.js    ← State machine (Idle → Ready → Charging → Release)
└── README.md
```

## Usage

1. Open `index.html` in Chrome (Web Serial requires Chromium)
2. Wait for the MediaPipe model to load (~2s)
3. Click **Start Tracking** — the SDF object will respond to your hand
4. **Pinch** to charge → **release** to emit a presence event
5. Connect serial to send to the 32×32 LED matrix

### Simulation Buttons
- **Sim Release** — triggers a local release animation (no hand needed)
- **Sim Receive** — simulates a remote event arriving

## Requirements

- Chrome or Chromium-based browser (Web Serial API)
- Webcam for hand tracking
- 32×32 HUB75 LED matrix + PicoDriver (optional, for physical output)
- Firmware: `x1_serial_rgb_client` (921600 baud, RGB565)
