/**
 * Main application module — orchestrates hand tracking, drawing, and serial.
 *
 * Single async loop handles everything in sequence:
 *   detect → draw → preview → send → next frame
 *
 * The await on sendImageData provides natural back-pressure:
 * the loop runs as fast as serial allows (~30-40fps).
 * This is the same proven pattern as j4_dithered-portrait live mode.
 */

import { connect, disconnect, isConnected, sendImageData } from './serial.js'
import * as Hand from './hand.js'
import * as Drawing from './drawing.js'

const MATRIX_SIZE = 32

// ─── DOM Elements ────────────────────────────────────────────────────────────

const video          = document.getElementById('video')
const matrixCanvas   = document.getElementById('matrixCanvas')
const btnConnect     = document.getElementById('btnConnect')
const btnStart       = document.getElementById('btnStart')
const btnClear       = document.getElementById('btnClear')
const colorPicker    = document.getElementById('colorPicker')
const timeoutSlider  = document.getElementById('timeoutSlider')
const timeoutValue   = document.getElementById('timeoutValue')
const brushSlider    = document.getElementById('brushSlider')
const brushValue     = document.getElementById('brushValue')
const logEl          = document.getElementById('log')
const statusDot      = document.getElementById('statusDot')

// ─── Canvas context ──────────────────────────────────────────────────────────

const matrixCtx = matrixCanvas.getContext('2d', { willReadFrequently: true })

// ─── State ───────────────────────────────────────────────────────────────────

let previousFingerPos = null
let modelReady = false
let handDetectedCount = 0
let serialPaused = false  // temporarily pause serial (for test button)

// ─── Logging ─────────────────────────────────────────────────────────────────

function log(msg) {
	const time = new Date().toLocaleTimeString()
	logEl.textContent = `[${time}] ${msg}\n` + logEl.textContent
}

// ─── Initialization ──────────────────────────────────────────────────────────

async function initModel() {
	log('Loading MediaPipe hand model…')
	try {
		await Hand.init()
		modelReady = true
		btnStart.disabled = false
		log('Hand model loaded ✓')
	} catch (err) {
		log('Failed to load hand model: ' + err.message)
	}
}

// Start model loading immediately
initModel()

// ─── Serial Connection ──────────────────────────────────────────────────────

btnConnect.addEventListener('click', async () => {
	if (isConnected()) {
		await disconnect()
		btnConnect.textContent = 'Connect Serial'
		statusDot.className = 'status-dot offline'
		log('Serial disconnected.')
	} else {
		const ok = await connect()
		if (ok) {
			btnConnect.textContent = 'Disconnect'
			statusDot.className = 'status-dot online'
			log('Serial connected!')
		} else {
			log('Serial connection failed.')
		}
	}
})

// ─── Start / Stop Tracking ──────────────────────────────────────────────────

btnStart.addEventListener('click', async () => {
	if (Hand.isRunning()) {
		stopTracking()
	} else {
		await startTracking()
	}
})

async function startTracking() {
	if (!modelReady) {
		log('Hand model not ready yet.')
		return
	}

	try {
		await Hand.start(video)
		video.classList.remove('hidden')
		btnStart.textContent = 'Stop Tracking'
		btnStart.classList.add('active')
		log('Hand tracking started.')
	} catch (err) {
		log('Camera error: ' + err.message)
	}
}

function stopTracking() {
	Hand.stop()
	video.classList.add('hidden')
	btnStart.textContent = 'Start Tracking'
	btnStart.classList.remove('active')
	previousFingerPos = null
	log('Hand tracking stopped.')
}

// ─── Hand Detection ─────────────────────────────────────────────────────────

function processHandDetection() {
	const results = Hand.detect()
	if (!results) return

	const pos = Hand.getIndexFingerTip(results)
	const pinching = Hand.isPinching(results)

	if (pos) {
		handDetectedCount++
		if (handDetectedCount === 1) {
			log(`Hand detected! Finger at (${pos.x}, ${pos.y})`)
		}

		if (pinching) {
			// Pinching — draw
			if (previousFingerPos) {
				Drawing.drawLine(previousFingerPos.x, previousFingerPos.y, pos.x, pos.y)
			} else {
				Drawing.drawPoint(pos.x, pos.y)
			}
			previousFingerPos = pos
		} else {
			// Hand open — move without drawing (break the line)
			previousFingerPos = null
		}
	} else {
		if (previousFingerPos) {
			log('Hand lost — line broken.')
		}
		previousFingerPos = null
	}
}

// ─── Main Loop ───────────────────────────────────────────────────────────────
//
// Single async loop: detect → draw → preview → send → next frame.
// The await on sendImageData creates natural back-pressure,
// throttling to whatever the serial wire can handle (~30-40fps).
// When serial is not connected, runs at RAF speed for smooth preview.

async function mainLoop() {
	// 1. Hand detection (synchronous GPU call)
	if (Hand.isRunning()) {
		processHandDetection()
	}

	// 2. Build image data (handles fading + expiration)
	const imageData = Drawing.getImageData()

	// 3. Preview on canvas
	matrixCtx.putImageData(imageData, 0, 0)

	// 4. Send to matrix — await provides back-pressure
	if (isConnected() && !serialPaused) {
		try {
			await sendImageData(imageData)
		} catch (err) {
			log('Serial send error: ' + err.message)
		}
	}

	// 5. Schedule next frame
	requestAnimationFrame(mainLoop)
}

// Start the loop immediately
requestAnimationFrame(mainLoop)

// ─── Controls ────────────────────────────────────────────────────────────────

// Color picker
colorPicker.addEventListener('input', () => {
	const hex = colorPicker.value
	const r = parseInt(hex.slice(1, 3), 16)
	const g = parseInt(hex.slice(3, 5), 16)
	const b = parseInt(hex.slice(5, 7), 16)
	Drawing.setBrushColor(r, g, b)
})

// Fade timeout slider
timeoutSlider.addEventListener('input', () => {
	const val = parseFloat(timeoutSlider.value)
	Drawing.setFadeTimeout(val)
	timeoutValue.textContent = val + 's'
})

// Brush size slider
brushSlider.addEventListener('input', () => {
	const val = parseInt(brushSlider.value)
	Drawing.setBrushSize(val)
	brushValue.textContent = val
})

// Clear button
btnClear.addEventListener('click', () => {
	Drawing.clearAll()
	log('Canvas cleared.')
})

// Test Serial button — sends a solid red frame to verify serial works
const btnTest = document.getElementById('btnTest')
if (btnTest) {
	btnTest.addEventListener('click', async () => {
		if (!isConnected()) {
			log('Connect serial first.')
			return
		}
		// Pause main loop serial sends, send test frame
		serialPaused = true
		const testData = new ImageData(32, 32)
		for (let i = 0; i < testData.data.length; i += 4) {
			testData.data[i + 0] = 255  // R
			testData.data[i + 1] = 0    // G
			testData.data[i + 2] = 0    // B
			testData.data[i + 3] = 255  // A
		}
		await sendImageData(testData)
		log('Test frame sent (solid red). Resuming in 2s…')
		// Resume after 2s so red stays visible
		setTimeout(() => { serialPaused = false }, 2000)
	})
}
