/**
 * Matrix Math Generator
 *
 * Visual effects driven by matrix/linear algebra operations:
 * rotation fields, transformation grids, eigenvector flow, shear waves.
 */

export const name = 'Matrix Math'

export const params = {
	speed: { value: 0.02, min: 0.005, max: 0.08, step: 0.005, label: 'Speed' },
	intensity: { value: 5, min: 1, max: 12, step: 1, label: 'Intensity' },
}

export function setup() {}

export function draw(ctx, frame, W, H) {
	const t = frame * params.speed.value
	const intensity = params.intensity.value
	const subMode = Math.floor(frame / 400) % 4

	const imgData = ctx.createImageData(W, H)
	const d = imgData.data

	for (let y = 0; y < H; y++) {
		for (let x = 0; x < W; x++) {
			const i = (y * W + x) * 4
			// Normalise to [-1, 1]
			const u = (x / W) * 2 - 1
			const v = (y / H) * 2 - 1
			let r = 0, g = 0, b = 0

			switch (subMode) {
				case 0: // Rotation field — each pixel's colour is the result
					// of applying a rotation matrix at varying angles
					{
						const angle = t + Math.sqrt(u * u + v * v) * intensity
						const cos = Math.cos(angle)
						const sin = Math.sin(angle)
						// Apply 2D rotation matrix [cos -sin; sin cos] to (u, v)
						const ru = u * cos - v * sin
						const rv = u * sin + v * cos
						r = Math.floor((ru * 0.5 + 0.5) * 255)
						g = Math.floor((rv * 0.5 + 0.5) * 255)
						b = Math.floor(Math.abs(Math.sin(angle * 2)) * 200)
					}
					break

				case 1: // Scaling / warping grid
					{
						const sx = 1 + Math.sin(t) * 0.5
						const sy = 1 + Math.cos(t * 1.3) * 0.5
						const wu = u * sx
						const wv = v * sy
						const grid = (Math.floor(wu * intensity) + Math.floor(wv * intensity)) % 2
						const glow = Math.sin(wu * 6 + t) * Math.cos(wv * 6 - t) * 0.5 + 0.5
						r = grid ? Math.floor(glow * 220) : 20
						g = grid ? Math.floor(glow * 100) : Math.floor(glow * 180)
						b = grid ? 40 : Math.floor(glow * 255)
					}
					break

				case 2: // Eigenvector-inspired flow
					{
						// Simulate a 2D vector field based on a matrix A = [[a,b],[c,d]]
						const a = Math.sin(t) * 2
						const bb = Math.cos(t * 0.7) * 1.5
						const c = Math.sin(t * 1.3) * 1.5
						const dd = Math.cos(t * 1.1) * 2
						// v' = A * (u,v)
						const fu = a * u + bb * v
						const fv = c * u + dd * v
						const mag = Math.sqrt(fu * fu + fv * fv)
						const angle = Math.atan2(fv, fu)
						r = Math.floor((mag * 0.3) * 255)
						g = Math.floor(((angle / Math.PI) * 0.5 + 0.5) * 200)
						b = Math.floor(Math.abs(Math.sin(mag * 3 - t * 2)) * 255)
					}
					break

				case 3: // Shear wave pattern
					{
						const shearX = Math.sin(t) * 2
						const shearY = Math.cos(t * 0.8) * 2
						const su = u + v * shearX
						const sv = v + u * shearY
						const wave1 = Math.sin(su * intensity + t * 3)
						const wave2 = Math.cos(sv * intensity - t * 2)
						r = Math.floor((wave1 * 0.5 + 0.5) * 200)
						g = Math.floor((wave2 * 0.5 + 0.5) * 200)
						b = Math.floor(((wave1 + wave2) * 0.25 + 0.5) * 255)
					}
					break
			}

			d[i] = Math.min(255, Math.max(0, r))
			d[i + 1] = Math.min(255, Math.max(0, g))
			d[i + 2] = Math.min(255, Math.max(0, b))
			d[i + 3] = 255
		}
	}

	ctx.putImageData(imgData, 0, 0)
}
