/**
 * Fractal Generator
 *
 * Renders animated fractals: Mandelbrot zoom, Julia set morphing,
 * Burning Ship, and Sierpinski carpet.
 */

export const name = 'Fractals'

export const params = {
	speed: { value: 0.005, min: 0.001, max: 0.03, step: 0.001, label: 'Speed' },
	maxIter: { value: 32, min: 8, max: 64, step: 4, label: 'Iterations' },
}

export function setup() {}

export function draw(ctx, frame, W, H) {
	const t = frame * params.speed.value
	const maxIter = params.maxIter.value
	const subFractal = Math.floor(frame / 500) % 4

	const imgData = ctx.createImageData(W, H)
	const d = imgData.data

	for (let py = 0; py < H; py++) {
		for (let px = 0; px < W; px++) {
			const i = (py * W + px) * 4
			let r = 0, g = 0, b = 0

			switch (subFractal) {
				case 0: // Mandelbrot zoom
					{
						// Slowly zoom into an interesting region
						const zoom = 1.5 + Math.sin(t * 0.5) * 0.8
						const cx = -0.745 + Math.sin(t * 0.3) * 0.05
						const cy = 0.186 + Math.cos(t * 0.3) * 0.05
						const x0 = (px / W - 0.5) / zoom + cx
						const y0 = (py / H - 0.5) / zoom + cy

						let x = 0, y = 0, iter = 0
						while (x * x + y * y <= 4 && iter < maxIter) {
							const xt = x * x - y * y + x0
							y = 2 * x * y + y0
							x = xt
							iter++
						}

						if (iter < maxIter) {
							const c = iter / maxIter
							r = Math.floor(c * 255)
							g = Math.floor(c * 100)
							b = Math.floor(Math.pow(c, 0.5) * 255)
						}
					}
					break

				case 1: // Julia set (morphing c)
					{
						const cr = -0.7 + Math.sin(t * 0.8) * 0.15
						const ci = 0.27015 + Math.cos(t * 0.6) * 0.1

						let x = (px / W) * 3.5 - 1.75
						let y = (py / H) * 3.5 - 1.75
						let iter = 0

						while (x * x + y * y <= 4 && iter < maxIter) {
							const xt = x * x - y * y + cr
							y = 2 * x * y + ci
							x = xt
							iter++
						}

						if (iter < maxIter) {
							const c = iter / maxIter
							r = Math.floor(Math.pow(c, 0.8) * 180)
							g = Math.floor(c * 255)
							b = Math.floor(Math.pow(c, 0.3) * 200)
						}
					}
					break

				case 2: // Burning Ship
					{
						const zoom = 2.5
						const x0 = (px / W) * 3.5 / zoom - 2.0 / zoom
						const y0 = (py / H) * 3.0 / zoom - 1.5 / zoom - 0.5

						let x = 0, y = 0, iter = 0
						while (x * x + y * y <= 4 && iter < maxIter) {
							const xt = x * x - y * y + x0
							y = Math.abs(2 * x * y) + y0
							x = xt
							iter++
						}

						if (iter < maxIter) {
							const c = iter / maxIter
							r = Math.floor(c * 255)
							g = Math.floor(c * 160)
							b = Math.floor(c * 60)
						}
					}
					break

				case 3: // Sierpinski carpet (animated)
					{
						let sx = px, sy = py
						let inSet = true
						const offset = Math.floor(t * 5) % 3

						for (let k = 0; k < 4; k++) {
							const size = Math.pow(3, 4 - k)
							const mx = Math.floor(sx / size) % 3
							const my = Math.floor(sy / size) % 3
							if (mx === 1 && my === 1) {
								inSet = false
								break
							}
						}

						if (inSet) {
							const wave = Math.sin(t * 2 + px * 0.3 + py * 0.3) * 0.5 + 0.5
							r = Math.floor(wave * 100 + 80)
							g = Math.floor(wave * 50 + 50)
							b = Math.floor(wave * 200 + 55)
						}
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
