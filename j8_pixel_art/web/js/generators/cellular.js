/**
 * Cellular Automaton Generator
 *
 * Game of Life and other cellular automata running on the 32×32 grid.
 */

export const name = 'Cellular Automata'

export const params = {
	speed: { value: 8, min: 1, max: 30, step: 1, label: 'Steps/sec' },
	density: { value: 0.35, min: 0.1, max: 0.7, step: 0.05, label: 'Init density' },
}

// Double-buffered grid
let gridA = null
let gridB = null
let W = 0, H = 0
let stepAccum = 0
let generation = 0

export function setup(width = 32, height = 32) {
	W = width
	H = height
	randomise()
}

function randomise() {
	gridA = new Uint8Array(W * H)
	gridB = new Uint8Array(W * H)
	const density = params.density.value
	for (let i = 0; i < W * H; i++) {
		gridA[i] = Math.random() < density ? 1 : 0
	}
	generation = 0
}

function step() {
	for (let y = 0; y < H; y++) {
		for (let x = 0; x < W; x++) {
			let neighbours = 0
			for (let dy = -1; dy <= 1; dy++) {
				for (let dx = -1; dx <= 1; dx++) {
					if (dx === 0 && dy === 0) continue
					const nx = (x + dx + W) % W
					const ny = (y + dy + H) % H
					neighbours += gridA[ny * W + nx]
				}
			}
			const idx = y * W + x
			const alive = gridA[idx]
			// Conway rules
			gridB[idx] = (alive && (neighbours === 2 || neighbours === 3)) || (!alive && neighbours === 3) ? 1 : 0
		}
	}
	// Swap buffers
	const tmp = gridA
	gridA = gridB
	gridB = tmp
	generation++

	// Auto-reset if stale (very low population)
	let pop = 0
	for (let i = 0; i < W * H; i++) pop += gridA[i]
	if (pop < 3 || generation > 600) randomise()
}

export function draw(ctx, frame, canvasW, canvasH) {
	if (!gridA) setup(canvasW, canvasH)

	// Step at configured rate (relative to ~30fps render)
	stepAccum += params.speed.value / 30
	while (stepAccum >= 1) {
		step()
		stepAccum--
	}

	// Render
	const imgData = ctx.createImageData(canvasW, canvasH)
	const d = imgData.data

	for (let y = 0; y < H; y++) {
		for (let x = 0; x < W; x++) {
			const i = (y * W + x) * 4
			const alive = gridA[y * W + x]
			if (alive) {
				// Colour based on position for visual interest
				d[i]     = 40 + ((x * 7) % 180)      // r
				d[i + 1] = 180 + ((y * 5) % 75)       // g
				d[i + 2] = 100 + (((x + y) * 3) % 155) // b
			} else {
				d[i] = 0
				d[i + 1] = 0
				d[i + 2] = 8 // dim blue background
			}
			d[i + 3] = 255
		}
	}

	ctx.putImageData(imgData, 0, 0)
}
