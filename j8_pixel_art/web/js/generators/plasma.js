/**
 * Plasma Generator
 *
 * Classic demoscene plasma effect using overlapping sine functions.
 */

export const name = 'Plasma'

export const params = {
	speed: { value: 0.04, min: 0.01, max: 0.12, step: 0.005, label: 'Speed' },
	palette: { value: 0, min: 0, max: 3, step: 1, label: 'Palette (0-3)' },
}

export function setup() {}

export function draw(ctx, frame, W, H) {
	const t = frame * params.speed.value
	const pal = params.palette.value

	const imgData = ctx.createImageData(W, H)
	const d = imgData.data

	for (let y = 0; y < H; y++) {
		for (let x = 0; x < W; x++) {
			const i = (y * W + x) * 4

			const v1 = Math.sin(x * 0.3 + t)
			const v2 = Math.sin((y * 0.3 + t * 0.7))
			const v3 = Math.sin((x * 0.3 + y * 0.3 + t * 0.5))
			const cx = x + 0.5 * Math.sin(t * 0.3) * W
			const cy = y + 0.5 * Math.cos(t * 0.4) * H
			const v4 = Math.sin(Math.sqrt(cx * cx + cy * cy) * 0.15)

			const v = (v1 + v2 + v3 + v4) * 0.25 // normalise to [-1, 1]

			let r, g, b
			switch (pal) {
				case 0: // Fire
					r = Math.floor((v * 0.5 + 0.5) * 255)
					g = Math.floor(Math.pow(v * 0.5 + 0.5, 2) * 200)
					b = Math.floor(Math.pow(v * 0.5 + 0.5, 4) * 150)
					break
				case 1: // Ocean
					r = Math.floor(Math.pow(v * 0.5 + 0.5, 3) * 100)
					g = Math.floor((v * 0.5 + 0.5) * 180)
					b = Math.floor((v * 0.5 + 0.5) * 255)
					break
				case 2: // Acid
					r = Math.floor(Math.abs(Math.sin(v * Math.PI)) * 255)
					g = Math.floor(Math.abs(Math.cos(v * Math.PI * 1.5)) * 255)
					b = Math.floor(Math.abs(Math.sin(v * Math.PI * 0.5 + 1)) * 200)
					break
				default: // Greyscale
					r = g = b = Math.floor((v * 0.5 + 0.5) * 255)
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
