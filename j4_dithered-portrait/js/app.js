/**
 * Main application module — orchestrates camera, dithering, and serial.
 *
 * Manages the UI state machine:
 *   1. Capture or load a portrait image
 *   2. Apply Floyd-Steinberg error diffusion dithering
 *   3. Preview the result
 *   4. Send to the 32x32 RGB LED matrix via serial
 */

import { connect, disconnect, isConnected, sendImageData } from './serial.js'
import { floydSteinberg } from './dither.js'
import { startCamera, stopCamera, isCameraActive, captureFrame, loadImageFile } from './camera.js'

const MATRIX_SIZE = 32

// ─── DOM Elements ────────────────────────────────────────────────────────────

const video         = document.getElementById('video')
const sourceCanvas  = document.getElementById('sourceCanvas')
const previewCanvas = document.getElementById('previewCanvas')
const btnConnect    = document.getElementById('btnConnect')
const btnCamera     = document.getElementById('btnCamera')
const btnCapture    = document.getElementById('btnCapture')
const btnSend       = document.getElementById('btnSend')
const btnLive       = document.getElementById('btnLive')
const fileInput     = document.getElementById('fileInput')
const chkGrayscale  = document.getElementById('chkGrayscale')
const strengthSlider = document.getElementById('strength')
const strengthValue  = document.getElementById('strengthValue')
const logEl         = document.getElementById('log')

// ─── Canvas contexts ─────────────────────────────────────────────────────────

const srcCtx = sourceCanvas.getContext('2d', { willReadFrequently: true })
const preCtx = previewCanvas.getContext('2d', { willReadFrequently: true })

// ─── State ───────────────────────────────────────────────────────────────────

let currentImageData = null  // The latest captured/loaded image (before dither)
let ditheredImageData = null // The latest dithered result
let liveMode = false
let liveRAF = null

// ─── Logging ─────────────────────────────────────────────────────────────────

function log(msg) {
	const time = new Date().toLocaleTimeString()
	logEl.textContent = `[${time}] ${msg}\n` + logEl.textContent
}

// ─── Serial Connection ──────────────────────────────────────────────────────

btnConnect.addEventListener('click', async () => {
	if (isConnected()) {
		await disconnect()
		btnConnect.textContent = 'Connect Serial'
		log('Serial disconnected.')
	} else {
		const ok = await connect()
		if (ok) {
			btnConnect.textContent = 'Disconnect'
			log('Serial connected!')
		} else {
			log('Serial connection failed.')
		}
	}
})

// ─── Camera ──────────────────────────────────────────────────────────────────

btnCamera.addEventListener('click', async () => {
	if (isCameraActive()) {
		stopCamera()
		stopLiveMode()
		video.classList.add('hidden')
		btnCamera.textContent = 'Start Camera'
		btnCapture.disabled = true
		btnLive.disabled = true
		log('Camera stopped.')
	} else {
		try {
			await startCamera(video)
			video.classList.remove('hidden')
			btnCamera.textContent = 'Stop Camera'
			btnCapture.disabled = false
			btnLive.disabled = false
			log('Camera started.')
		} catch (err) {
			log('Camera error: ' + err.message)
		}
	}
})

// ─── Capture ─────────────────────────────────────────────────────────────────

btnCapture.addEventListener('click', () => {
	if (!isCameraActive()) return
	stopLiveMode()
	currentImageData = captureFrame(video, srcCtx)
	applyDither()
	log('Frame captured.')
})

// ─── File Input ──────────────────────────────────────────────────────────────

fileInput.addEventListener('change', async (e) => {
	const file = e.target.files[0]
	if (!file) return
	stopLiveMode()
	try {
		currentImageData = await loadImageFile(file, srcCtx)
		applyDither()
		log(`Image loaded: ${file.name}`)
	} catch (err) {
		log('Failed to load image: ' + err.message)
	}
})

// ─── Dithering Controls ─────────────────────────────────────────────────────

chkGrayscale.addEventListener('change', () => {
	if (currentImageData) applyDither()
})

strengthSlider.addEventListener('input', () => {
	strengthValue.textContent = strengthSlider.value
	if (currentImageData) applyDither()
})

/**
 * Apply Floyd-Steinberg dithering to the current source image
 * and display the result on the preview canvas.
 */
function applyDither() {
	if (!currentImageData) return

	// Clone the image data so the source is preserved
	const clone = new ImageData(
		new Uint8ClampedArray(currentImageData.data),
		MATRIX_SIZE,
		MATRIX_SIZE
	)

	const options = {
		grayscale: chkGrayscale.checked,
		strength: parseFloat(strengthSlider.value)
	}

	ditheredImageData = floydSteinberg(clone, options)
	preCtx.putImageData(ditheredImageData, 0, 0)
}

// ─── Send to Matrix ──────────────────────────────────────────────────────────

btnSend.addEventListener('click', async () => {
	if (!ditheredImageData) {
		log('Nothing to send — capture or load an image first.')
		return
	}
	if (!isConnected()) {
		log('Serial not connected.')
		return
	}
	await sendImageData(ditheredImageData)
	log('Image sent to matrix.')
})

// ─── Live Mode ───────────────────────────────────────────────────────────────

btnLive.addEventListener('click', () => {
	if (liveMode) {
		stopLiveMode()
	} else {
		startLiveMode()
	}
})

function startLiveMode() {
	if (!isCameraActive()) {
		log('Start the camera first.')
		return
	}
	liveMode = true
	btnLive.textContent = 'Stop Live'
	btnLive.classList.add('active')
	log('Live mode started.')
	liveLoop()
}

function stopLiveMode() {
	liveMode = false
	btnLive.textContent = 'Live Mode'
	btnLive.classList.remove('active')
	if (liveRAF) {
		cancelAnimationFrame(liveRAF)
		liveRAF = null
	}
}

async function liveLoop() {
	if (!liveMode || !isCameraActive()) {
		stopLiveMode()
		return
	}

	// Capture, dither, and send
	currentImageData = captureFrame(video, srcCtx)
	applyDither()

	if (isConnected() && ditheredImageData) {
		await sendImageData(ditheredImageData)
	}

	liveRAF = requestAnimationFrame(liveLoop)
}
