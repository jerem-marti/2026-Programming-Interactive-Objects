/**
 * Metaballs Generator
 *
 * Soft glowing blobs that float, merge, and split.
 * Classic demoscene effect — two tuneable parameters.
 */

export const name = 'Metaballs'

export const params = {
	blobs: { value: 4, min: 2, max: 8, step: 1, label: 'Blobs' },
	speed: { value: 0.015, min: 0.005, max: 0.06, step: 0.005, label: 'Speed' },
}

// Each blob has its own orbit defined by random phase offsets
const seeds = Array.from({ length: 8 }, () => ({
	px: Math.random() * Math.PI * 2,
	py: Math.random() * Math.PI * 2,
	freqX: 0.7 + Math.random() * 1.3,
	freqY: 0.5 + Math.random() * 1.5,
}))

export function setup() {}

export function draw(ctx, frame, W, H) {
	const t = frame * params.speed.value
	const n = params.blobs.value

	const imgData = ctx.createImageData(W, H)
	const d = imgData.data

	// Compute blob centres (normalised 0–1)
	const blobs = []
	for (let i = 0; i < n; i++) {
		const s = seeds[i]
		blobs.push({
			x: (Math.sin(t * s.freqX + s.px) * 0.4 + 0.5) * W,
			y: (Math.cos(t * s.freqY + s.py) * 0.4 + 0.5) * H,
		})
	}

	for (let y = 0; y < H; y++) {
		for (let x = 0; x < W; x++) {
			// Sum of inverse-square distances (the metaball field)
			let sum = 0
			for (let i = 0; i < n; i++) {
				const dx = x - blobs[i].x
				const dy = y - blobs[i].y
				sum += 1.0 / (dx * dx + dy * dy + 1)
			}

			// Normalise into a nice visual range
			const v = Math.min(sum * 80, 1)

			// Colour ramp: dark → magenta → orange → white
			const i4 = (y * W + x) * 4
			d[i4]     = Math.floor(v * v * 255)                              // r
			d[i4 + 1] = Math.floor(Math.pow(v, 3) * 200)                     // g
			d[i4 + 2] = Math.floor(Math.pow(Math.sin(v * Math.PI), 0.6) * 255) // b
			d[i4 + 3] = 255
		}
	}

	ctx.putImageData(imgData, 0, 0)
}
