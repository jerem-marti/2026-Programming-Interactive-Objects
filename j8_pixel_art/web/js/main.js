/**
 * Main application — orchestrates generators, canvas, serial and UI.
 *
 * Architecture:
 *   index.html           – markup & styles
 *   js/main.js           – this file (entry point, render loop, UI binding)
 *   js/serial.js         – Web Serial API wrapper
 *   js/canvas.js         – canvas init & helpers
 *   js/generators/*.js   – pluggable pixel-art generators
 */

import { connect, isConnected, sendFrame } from './serial.js'
import { initCanvas, clear, getImageData } from './canvas.js'

// ── Generators (lazy-loaded ES modules) ─────────────────────────────────────
import * as pattern    from './generators/pattern.js'
import * as mathModel  from './generators/math-model.js'
import * as fractal    from './generators/fractal.js'
import * as matrixMath from './generators/matrix-math.js'
import * as cellular   from './generators/cellular.js'
import * as plasma     from './generators/plasma.js'
import * as metaballs  from './generators/metaballs.js'
import * as liquidFlow from './generators/liquid-flow.js'

const GENERATORS = [pattern, mathModel, fractal, matrixMath, cellular, plasma, metaballs, liquidFlow]

// ── Constants ───────────────────────────────────────────────────────────────
const W = 32
const H = 32
const COLOR_DEPTH = 16
const TARGET_FPS = 30
const SEND_BUFFER = new Uint8Array(1 + W * H * (COLOR_DEPTH / 8))

// ── DOM references ──────────────────────────────────────────────────────────
const canvasEl   = document.getElementById('canvas')
const btnConnect = document.getElementById('btn-connect')
const selGen     = document.getElementById('sel-generator')
const paramsDiv  = document.getElementById('params')
const logEl      = document.getElementById('log')
const fpsEl      = document.getElementById('fps')
const btnPause   = document.getElementById('btn-pause')

// ── State ───────────────────────────────────────────────────────────────────
let ctx
let currentGen = GENERATORS[0]
let frame = 0
let paused = false
let timeSample = 0

// ── FPS counter ─────────────────────────────────────────────────────────────
const FPS = {
	frames: 0,
	ptime: 0,
	fps: 0,
	tick(time) {
		this.frames++
		if (time >= this.ptime + 1000) {
			this.fps = (this.frames * 1000) / (time - this.ptime)
			this.ptime = time
			this.frames = 0
		}
		return this.fps
	},
}

// ── Initialisation ──────────────────────────────────────────────────────────
function init() {
	ctx = initCanvas(canvasEl, W, H)

	// Populate generator selector
	GENERATORS.forEach((gen, i) => {
		const opt = document.createElement('option')
		opt.value = i
		opt.textContent = gen.name
		selGen.appendChild(opt)
	})

	selGen.addEventListener('change', () => {
		currentGen = GENERATORS[selGen.value]
		frame = 0
		if (currentGen.setup) currentGen.setup(W, H)
		buildParamsUI()
	})

	btnConnect.addEventListener('click', async () => {
		log('Requesting serial port…')
		const ok = await connect()
		log(ok ? 'Serial connected ✓' : 'Connection failed ✗')
		btnConnect.textContent = ok ? 'Connected' : 'Connect Serial Port'
		btnConnect.disabled = ok
	})

	btnPause.addEventListener('click', () => {
		paused = !paused
		btnPause.textContent = paused ? '▶ Resume' : '⏸ Pause'
	})

	// Setup first generator
	if (currentGen.setup) currentGen.setup(W, H)
	buildParamsUI()

	// ── Canvas mouse interaction (for generators that support it) ──────
	let mouseDown = false
	let mouseButton = 0

	function canvasToGrid(e) {
		const rect = canvasEl.getBoundingClientRect()
		const scaleX = W / rect.width
		const scaleY = H / rect.height
		return {
			x: Math.floor((e.clientX - rect.left) * scaleX),
			y: Math.floor((e.clientY - rect.top) * scaleY),
		}
	}

	function interact(e) {
		if (!currentGen.onCanvasInteract) return
		const { x, y } = canvasToGrid(e)
		const mode = mouseButton === 2 ? 'erase' : 'place'
		currentGen.onCanvasInteract(x, y, mode)
	}

	canvasEl.addEventListener('mousedown', (e) => {
		mouseDown = true
		mouseButton = e.button
		interact(e)
	})
	canvasEl.addEventListener('mousemove', (e) => {
		if (mouseDown) interact(e)
	})
	window.addEventListener('mouseup', () => { mouseDown = false })
	canvasEl.addEventListener('contextmenu', (e) => e.preventDefault())

	requestAnimationFrame(loop)
}

// ── Parameter UI builder ────────────────────────────────────────────────────
function buildParamsUI() {
	paramsDiv.innerHTML = ''
	if (!currentGen.params) return

	for (const [key, p] of Object.entries(currentGen.params)) {
		const wrapper = document.createElement('div')
		wrapper.className = 'param'

		const label = document.createElement('label')
		label.textContent = p.label || key
		const valSpan = document.createElement('span')
		valSpan.className = 'param-val'
		valSpan.textContent = p.value

		const input = document.createElement('input')
		input.type = 'range'
		input.min = p.min
		input.max = p.max
		input.step = p.step
		input.value = p.value
		input.addEventListener('input', () => {
			p.value = parseFloat(input.value)
			valSpan.textContent = p.value
		})

		label.appendChild(valSpan)
		wrapper.appendChild(label)
		wrapper.appendChild(input)
		paramsDiv.appendChild(wrapper)
	}
}

// ── Render loop ─────────────────────────────────────────────────────────────
async function loop(time) {
	requestAnimationFrame(loop)

	// Throttle to TARGET_FPS
	const delta = time - timeSample
	const interval = 1000 / TARGET_FPS
	if (delta < interval) return
	timeSample = time - (delta % interval)

	fpsEl.textContent = FPS.tick(time).toFixed(1)

	if (paused) return

	// Clear & draw
	clear(ctx, W, H)
	currentGen.draw(ctx, frame, W, H)
	frame++

	// Send over serial
	if (isConnected()) {
		const imageData = getImageData(ctx, W, H)
		await sendFrame(imageData, SEND_BUFFER)
	}
}

// ── Logging helper ──────────────────────────────────────────────────────────
function log(msg) {
	const line = document.createElement('div')
	line.textContent = msg
	logEl.appendChild(line)
	logEl.scrollTop = logEl.scrollHeight
}

// ── Go ──────────────────────────────────────────────────────────────────────
init()
