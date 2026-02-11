/**
 * Main application module — Dithered Face Mimicry
 *
 * Orchestrates all modules:
 *   camera.js       → webcam stream
 *   faceMesh.js     → MediaPipe face landmark detection
 *   faceRenderer.js → face cropping / pixel-art generation
 *   dither.js       → Floyd-Steinberg error diffusion
 *   serial.js       → Web Serial to 32×32 LED matrix
 *
 * UI state machine:
 *   1. Start webcam
 *   2. Load MediaPipe model
 *   3. Live loop: detect → render → dither → preview (→ send to matrix)
 */

import { startCamera, stopCamera, isCameraActive, getVideoElement } from './camera.js'
import { initFaceMesh, isMeshReady, detectFace }                    from './faceMesh.js'
import { renderPhotoCrop, renderFullFrame, renderPixelArt }          from './faceRenderer.js'
import { floydSteinberg }                                            from './dither.js'
import { connect, disconnect, isConnected, sendImageData }           from './serial.js'

const MATRIX_SIZE = 32

// ─── DOM Elements ────────────────────────────────────────────────────────────

const video          = document.getElementById('video')
const sourceCanvas   = document.getElementById('sourceCanvas')
const previewCanvas  = document.getElementById('previewCanvas')
const overlayCanvas  = document.getElementById('overlayCanvas')
const btnConnect     = document.getElementById('btnConnect')
const btnCamera      = document.getElementById('btnCamera')
const btnMode        = document.getElementById('btnMode')
const chkDither      = document.getElementById('chkDither')
const chkGrayscale   = document.getElementById('chkGrayscale')
const strengthSlider = document.getElementById('strength')
const strengthValue  = document.getElementById('strengthValue')
const chkMesh        = document.getElementById('chkMesh')
const logEl          = document.getElementById('log')
const statusDot      = document.getElementById('statusDot')
const statusText     = document.getElementById('statusText')

// ─── Canvas contexts ─────────────────────────────────────────────────────────

const srcCtx     = sourceCanvas.getContext('2d', { willReadFrequently: true })
const preCtx     = previewCanvas.getContext('2d', { willReadFrequently: true })
const overlayCtx = overlayCanvas.getContext('2d')

// ─── State ───────────────────────────────────────────────────────────────────

let renderMode = 'photo'    // 'photo' | 'pixelart'
let liveMode   = false
let liveRAF    = null
let lastFace   = null
let modelLoading = false

// ─── Logging ─────────────────────────────────────────────────────────────────

function log(msg) {
	const t = new Date().toLocaleTimeString()
	logEl.textContent = `[${t}] ${msg}\n` + logEl.textContent
}

function setStatus(state, text) {
	statusDot.className = 'dot ' + state   // 'idle' | 'active' | 'error'
	statusText.textContent = text
}

// ─── Init MediaPipe ──────────────────────────────────────────────────────────

async function loadModel() {
	if (isMeshReady() || modelLoading) return
	modelLoading = true
	log('Loading MediaPipe FaceMesh model…')
	setStatus('idle', 'Loading model…')
	try {
		await initFaceMesh()
		log('FaceMesh model ready.')
		setStatus('active', 'Model ready')
		modelLoading = false
	} catch (err) {
		log('Model load error: ' + err.message)
		setStatus('error', 'Model error')
		modelLoading = false
	}
}

// Start loading the model immediately
loadModel()

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
		stopLiveMode()
		stopCamera()
		video.classList.add('hidden')
		btnCamera.textContent = '📷 Start Camera'
		setStatus('idle', 'Camera off')
		log('Camera stopped.')
	} else {
		try {
			await startCamera(video)
			video.classList.remove('hidden')
			btnCamera.textContent = '⏹ Stop Camera'
			log('Camera started.')
			startLiveMode()
		} catch (err) {
			log('Camera error: ' + err.message)
			setStatus('error', 'Camera error')
		}
	}
})

// ─── Render Mode Toggle ─────────────────────────────────────────────────────

btnMode.addEventListener('click', () => {
	renderMode = renderMode === 'photo' ? 'pixelart' : 'photo'
	btnMode.textContent = renderMode === 'photo' ? '🎨 Pixel Art Mode' : '📸 Photo Mode'
	btnMode.classList.toggle('active', renderMode === 'pixelart')
	log(`Render mode: ${renderMode}`)
})

// ─── Dithering Controls ─────────────────────────────────────────────────────

strengthSlider.addEventListener('input', () => {
	strengthValue.textContent = strengthSlider.value
})

// ─── Mesh Overlay Toggle ────────────────────────────────────────────────────

chkMesh.addEventListener('change', () => {
	overlayCanvas.style.display = chkMesh.checked ? 'block' : 'none'
})

// ─── Live Loop ───────────────────────────────────────────────────────────────

function startLiveMode() {
	if (liveMode) return
	liveMode = true
	setStatus('active', 'Live')
	log('Live mode started.')
	liveLoop()
}

function stopLiveMode() {
	liveMode = false
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

	const videoEl = getVideoElement()
	if (!videoEl || videoEl.readyState < 2) {
		liveRAF = requestAnimationFrame(liveLoop)
		return
	}

	// ── Face Detection ──────────────────────────────────────────────────
	let face = null
	if (isMeshReady()) {
		face = detectFace(videoEl)
		lastFace = face
	}

	// ── Render source ───────────────────────────────────────────────────
	let sourceImage

	if (renderMode === 'pixelart' && face) {
		sourceImage = renderPixelArt(face, srcCtx)
	} else if (face) {
		sourceImage = renderPhotoCrop(videoEl, face, srcCtx)
	} else {
		sourceImage = renderFullFrame(videoEl, srcCtx)
	}

	// ── Dither ──────────────────────────────────────────────────────────
	let outputImage

	if (chkDither.checked) {
		const clone = new ImageData(
			new Uint8ClampedArray(sourceImage.data),
			MATRIX_SIZE, MATRIX_SIZE
		)
		outputImage = floydSteinberg(clone, {
			grayscale: chkGrayscale.checked,
			strength:  parseFloat(strengthSlider.value)
		})
	} else {
		outputImage = sourceImage
	}

	preCtx.putImageData(outputImage, 0, 0)

	// ── Mesh overlay on video ───────────────────────────────────────────
	if (chkMesh.checked && face) {
		drawMeshOverlay(face)
	} else {
		overlayCtx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height)
	}

	// ── Send to matrix ──────────────────────────────────────────────────
	if (isConnected()) {
		await sendImageData(outputImage)
	}

	liveRAF = requestAnimationFrame(liveLoop)
}

// ─── Mesh Overlay Drawing ───────────────────────────────────────────────────

function drawMeshOverlay(face) {
	const w = overlayCanvas.width
	const h = overlayCanvas.height
	overlayCtx.clearRect(0, 0, w, h)
	overlayCtx.fillStyle = 'rgba(0, 255, 128, 0.4)'

	for (const lm of face.landmarks) {
		const x = lm.x * w
		const y = lm.y * h
		overlayCtx.fillRect(x - 0.5, y - 0.5, 1.5, 1.5)
	}

	// Expression info
	overlayCtx.fillStyle = '#0f8'
	overlayCtx.font = '10px monospace'
	overlayCtx.fillText(`L-eye: ${face.leftEyeOpen.toFixed(2)}`, 4, 12)
	overlayCtx.fillText(`R-eye: ${face.rightEyeOpen.toFixed(2)}`, 4, 24)
	overlayCtx.fillText(`Mouth: ${face.mouthOpen.toFixed(2)}`, 4, 36)
	overlayCtx.fillText(`Yaw:   ${(face.headYaw * 57.3).toFixed(0)}°`, 4, 48)
}

// ─── Initial state ──────────────────────────────────────────────────────────

setStatus('idle', 'Ready')
log('Ready. Start the camera to begin face tracking.')
