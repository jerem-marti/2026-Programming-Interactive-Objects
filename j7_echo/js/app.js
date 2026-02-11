/**
 * Main application module — Echo: Send-a-Pixel Ritual.
 *
 * Orchestrates hand tracking, ritual state machine, SDF rendering,
 * and serial output in a single async RAF loop.
 *
 * Pipeline each frame:
 *   detect hand → update ritual → render SDF → preview → send serial
 *
 * The await on sendImageData provides natural back-pressure:
 * the loop runs as fast as serial allows (~25-35fps at 32×32).
 */

import { connect, disconnect, isConnected, sendImageData } from './serial.js'
import * as Hand from './hand.js'
import * as SDF from './sdf.js'
import * as Ritual from './ritual.js'

const MATRIX_SIZE = 32

// ─── DOM Elements ────────────────────────────────────────────────────────────

const video          = document.getElementById('video')
const matrixCanvas   = document.getElementById('matrixCanvas')
const btnConnect     = document.getElementById('btnConnect')
const btnStart       = document.getElementById('btnStart')
const btnSimRelease  = document.getElementById('btnSimRelease')
const btnSimReceive  = document.getElementById('btnSimReceive')
const btnTest        = document.getElementById('btnTest')
const shapeSelect    = document.getElementById('shapeSelect')
const warpSlider     = document.getElementById('warpSlider')
const warpValue      = document.getElementById('warpValue')
const rotSpeedSlider = document.getElementById('rotSpeedSlider')
const rotSpeedValue  = document.getElementById('rotSpeedValue')
const ditherSlider   = document.getElementById('ditherSlider')
const ditherValue    = document.getElementById('ditherValue')
const stateValueEl   = document.getElementById('stateValue')
const energyFillEl   = document.getElementById('energyFill')
const memoryListEl   = document.getElementById('memoryList')
const logEl          = document.getElementById('log')
const statusDot      = document.getElementById('statusDot')

// ─── Canvas context ──────────────────────────────────────────────────────────

const matrixCtx = matrixCanvas.getContext('2d', { willReadFrequently: true })
const imageData = matrixCtx.createImageData(MATRIX_SIZE, MATRIX_SIZE)

// ─── State ───────────────────────────────────────────────────────────────────

let modelReady = false
let serialPaused = false
let lastFrameTime = performance.now()
let startTime = performance.now()

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
	log('Hand tracking stopped.')
}

// ─── Simulation buttons ─────────────────────────────────────────────────────

btnSimRelease.addEventListener('click', () => {
	// Simulate a charging + release cycle
	const params = SDF.getParams()
	params.coreEnergy = 0.8
	params.coreFocus = 0.7
	const seed = Math.floor(Math.random() * 65536)
	SDF.addScar(seed, 0.7)
	log(`Simulated local release (seed: ${seed})`)

	// Trigger release animation
	params.bloom = 1.0
	setTimeout(() => {
		params.shockwave = 0.8
		params.shockPhase = 0
	}, 200)
	setTimeout(() => {
		params.bloom *= 0.3
		params.coreEnergy *= 0.5
	}, 800)

	updateMemoryUI()
})

btnSimReceive.addEventListener('click', () => {
	const seed = Math.floor(Math.random() * 65536)
	const energy = 0.5 + Math.random() * 0.5
	Ritual.receiveRemoteEvent(seed, energy)
	log(`Simulated remote event (seed: ${seed}, energy: ${energy.toFixed(2)})`)
})

// ─── Settings controls ──────────────────────────────────────────────────────

shapeSelect.addEventListener('change', () => {
	SDF.setShape(shapeSelect.value)
	log(`Shape: ${shapeSelect.value}`)
})

warpSlider.addEventListener('input', () => {
	const val = parseInt(warpSlider.value)
	SDF.getParams().warpAmount = val / 100
	warpValue.textContent = val + '%'
})

rotSpeedSlider.addEventListener('input', () => {
	const val = parseInt(rotSpeedSlider.value)
	SDF.getParams().rotSpeed = val / 100
	rotSpeedValue.textContent = val + '%'
})

ditherSlider.addEventListener('input', () => {
	const val = parseInt(ditherSlider.value)
	SDF.getParams().ditherAmount = val / 100
	ditherValue.textContent = val + '%'
})

// ─── Test Serial ─────────────────────────────────────────────────────────────

if (btnTest) {
	btnTest.addEventListener('click', async () => {
		if (!isConnected()) {
			log('Connect serial first.')
			return
		}
		serialPaused = true
		const testData = new ImageData(32, 32)
		for (let i = 0; i < testData.data.length; i += 4) {
			testData.data[i + 0] = 255
			testData.data[i + 1] = 0
			testData.data[i + 2] = 0
			testData.data[i + 3] = 255
		}
		await sendImageData(testData)
		log('Test frame sent (solid red). Resuming in 2s…')
		setTimeout(() => { serialPaused = false }, 2000)
	})
}

// ─── Memory UI ───────────────────────────────────────────────────────────────

function updateMemoryUI() {
	const scars = SDF.getScars()
	if (scars.length === 0) {
		memoryListEl.innerHTML = '<em style="color:#555;">No events yet</em>'
		return
	}
	memoryListEl.innerHTML = scars.map((s, i) => {
		const age = s.age
		const ageStr = age < 60 ? `${Math.floor(age)}s` :
		               age < 3600 ? `${Math.floor(age / 60)}m` :
		               `${(age / 3600).toFixed(1)}h`
		const fade = (1 - s.age / s.maxAge) * 100
		return `<div class="event">
			#${i + 1} seed:${s.seed} energy:${s.energy.toFixed(2)} age:${ageStr} (${fade.toFixed(0)}%)
		</div>`
	}).join('')
}

// ─── Main Loop ───────────────────────────────────────────────────────────────

async function mainLoop() {
	const now = performance.now()
	const dt = Math.min((now - lastFrameTime) / 1000, 0.1) // Cap dt at 100ms
	lastFrameTime = now

	const sdfParams = SDF.getParams()
	sdfParams.time = (now - startTime) / 1000

	// 1. Hand detection
	let gesture = null
	if (Hand.isRunning()) {
		gesture = Hand.detect()
	}

	// 2. Update ritual state machine → mutates SDF params
	Ritual.update(gesture, sdfParams, dt, (seed, energy) => {
		SDF.addScar(seed, energy)
		updateMemoryUI()
	})

	// 3. Check for pending release events (for future transmission)
	const released = Ritual.consumeRelease()
	if (released) {
		log(`✦ Release! seed:${released.seed} energy:${released.energy.toFixed(2)}`)
		updateMemoryUI()
	}

	// 4. Render SDF scene to imageData
	SDF.render(imageData, dt)

	// 5. Preview on canvas
	matrixCtx.putImageData(imageData, 0, 0)

	// 6. Update UI
	stateValueEl.textContent = Ritual.getState()
	energyFillEl.style.width = (Ritual.getEnergy() * 100) + '%'

	// 7. Send to matrix
	if (isConnected() && !serialPaused) {
		try {
			await sendImageData(imageData)
		} catch (err) {
			log('Serial send error: ' + err.message)
		}
	}

	// 8. Periodically update memory UI (every ~2 seconds)
	if (Math.floor(sdfParams.time) % 2 === 0 && Math.floor(sdfParams.time) !== Math.floor(sdfParams.time - dt)) {
		updateMemoryUI()
	}

	// 9. Schedule next frame
	requestAnimationFrame(mainLoop)
}

// Start the loop immediately
requestAnimationFrame(mainLoop)
