/**
 * Mathematical Model Generator
 *
 * Visualisations based on math functions:
 * sine interference, Lissajous curves, parametric roses, wave superposition.
 */

export const name = 'Math Models'

export const params = {
	speed: { value: 0.02, min: 0.005, max: 0.1, step: 0.005, label: 'Speed' },
	complexity: { value: 3, min: 1, max: 8, step: 1, label: 'Complexity' },
}

export function setup() {}

export function draw(ctx, frame, W, H) {
	const t = frame * params.speed.value
	const n = params.complexity.value
	const subModel = Math.floor(frame / 400) % 4

	const imgData = ctx.createImageData(W, H)
	const d = imgData.data

	for (let y = 0; y < H; y++) {
		for (let x = 0; x < W; x++) {
			const i = (y * W + x) * 4
			// Normalised coordinates [-1, 1]
			const u = (x / W) * 2 - 1
			const v = (y / H) * 2 - 1
			let r = 0, g = 0, b = 0

			switch (subModel) {
				case 0: // Sine interference
					{
						let val = 0
						for (let k = 1; k <= n; k++) {
							val += Math.sin(u * k * 3 + t * k) * Math.cos(v * k * 3 - t * k * 0.7)
						}
						val = val / n * 0.5 + 0.5
						r = Math.floor(val * 255)
						g = Math.floor(Math.pow(val, 2) * 200)
						b = Math.floor((1 - val) * 255)
					}
					break

				case 1: // Lissajous field
					{
						const lx = Math.sin(t * 1.1) * Math.cos(t * 0.7)
						const ly = Math.cos(t * 1.3) * Math.sin(t * 0.9)
						const dist = Math.sqrt((u - lx) ** 2 + (v - ly) ** 2)
						const val = Math.exp(-dist * 5) + Math.exp(-dist * 2) * 0.5
						r = Math.floor(Math.min(val * 400, 255))
						g = Math.floor(Math.min(val * 200, 255))
						b = Math.floor(Math.min(val * 100, 255))
					}
					break

				case 2: // Parametric rose field
					{
						const angle = Math.atan2(v, u)
						const dist = Math.sqrt(u * u + v * v)
						const rose = Math.cos(n * angle + t)
						const val = Math.abs(rose) - dist
						const c = Math.max(0, Math.min(1, val * 3 + 0.2))
						r = Math.floor(c * 255)
						g = Math.floor(c * 50)
						b = Math.floor(c * 180)
					}
					break

				case 3: // Superposition of waves
					{
						let val = 0
						for (let k = 0; k < n; k++) {
							const angle = (k / n) * Math.PI * 2
							const dx = Math.cos(angle)
							const dy = Math.sin(angle)
							val += Math.sin((u * dx + v * dy) * 8 + t * (k + 1) * 0.5)
						}
						val = val / n * 0.5 + 0.5
						r = Math.floor(val * 100)
						g = Math.floor(val * 255)
						b = Math.floor(Math.pow(val, 0.5) * 200)
					}
					break
			}

			d[i] = r
			d[i + 1] = g
			d[i + 2] = b
			d[i + 3] = 255
		}
	}

	ctx.putImageData(imgData, 0, 0)
}
