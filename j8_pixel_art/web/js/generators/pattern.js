/**
 * Pixel Pattern Generator
 *
 * Geometric patterns: checkerboard, stripes, concentric rings, spiral.
 * Cycles through sub-patterns automatically.
 */

export const name = 'Pixel Patterns'

export const params = {
	speed: { value: 0.03, min: 0.005, max: 0.15, step: 0.005, label: 'Speed' },
	scale: { value: 4, min: 1, max: 16, step: 1, label: 'Scale' },
}

export function setup() {}

export function draw(ctx, frame, W, H) {
	const t = frame * params.speed.value
	const s = params.scale.value
	const subPattern = Math.floor(frame / 300) % 4

	const imgData = ctx.createImageData(W, H)
	const d = imgData.data

	for (let y = 0; y < H; y++) {
		for (let x = 0; x < W; x++) {
			const i = (y * W + x) * 4
			let r = 0, g = 0, b = 0

			switch (subPattern) {
				case 0: // Animated checkerboard
					{
						const cx = Math.floor((x + t * 5) / s)
						const cy = Math.floor((y + t * 3) / s)
						const on = (cx + cy) % 2 === 0
						r = on ? 255 : 0
						g = on ? 100 : 180
						b = on ? 0 : 255
					}
					break

				case 1: // Diagonal stripes
					{
						const v = Math.sin((x + y) * 0.5 + t * 2)
						r = Math.floor((v * 0.5 + 0.5) * 255)
						g = Math.floor((Math.sin((x - y) * 0.3 + t) * 0.5 + 0.5) * 255)
						b = 80
					}
					break

				case 2: // Concentric rings
					{
						const dx = x - W / 2
						const dy = y - H / 2
						const dist = Math.sqrt(dx * dx + dy * dy)
						const v = Math.sin(dist * 0.8 - t * 3)
						r = Math.floor((v * 0.5 + 0.5) * 200)
						g = 50
						b = Math.floor((1 - v * 0.5 - 0.5) * 255)
					}
					break

				case 3: // Spiral
					{
						const dx = x - W / 2
						const dy = y - H / 2
						const angle = Math.atan2(dy, dx)
						const dist = Math.sqrt(dx * dx + dy * dy)
						const v = Math.sin(angle * 3 + dist * 0.5 - t * 2)
						r = Math.floor((v * 0.5 + 0.5) * 255)
						g = Math.floor((v * 0.5 + 0.5) * 120)
						b = Math.floor((-v * 0.5 + 0.5) * 255)
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
