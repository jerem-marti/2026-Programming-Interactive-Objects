/**
 * Liquid Flow Generator
 *
 * Laminar-flow streamline visualisation on a 32×32 grid.
 * Particles trace continuous 1-pixel-wide lines through a velocity
 * field that deflects around point obstacles (single-dot walls).
 *
 * Hue encodes local velocity — calm flow is blue, accelerated flow
 * around obstacles shifts toward red/orange.
 *
 * Click on the canvas to place single-dot obstacles.
 * Right-click to erase.
 */

export const name = 'Liquid Flow'

export const params = {
	lines: { value: 24, min: 4, max: 32, step: 1, label: 'Lines' },
	speed: { value: 1.0, min: 0.2, max: 3.0, step: 0.1, label: 'Speed' },
}

const WALL = 1

let obstacles = null
let vx = null
let vy = null
let particles = null
let W = 0, H = 0
let fieldDirty = true

export function setup(width = 32, height = 32) {
	W = width
	H = height
	obstacles = new Uint8Array(W * H)
	vx = new Float32Array(W * H)
	vy = new Float32Array(W * H)

	// A handful of default dot obstacles
	const dots = [
		[10, 10], [22, 8], [8, 20], [16, 16],
		[25, 22], [14, 26], [6, 14], [20, 14], [28, 18],
	]
	for (const [dx, dy] of dots) obstacles[dy * W + dx] = WALL

	fieldDirty = true
	initParticles()
}

// ── Velocity field ──────────────────────────────────────────────────────────

function buildField() {
	for (let y = 0; y < H; y++) {
		for (let x = 0; x < W; x++) {
			const i = y * W + x
			if (obstacles[i] === WALL) { vx[i] = 0; vy[i] = 0; continue }

			// Uniform base flow → right
			let fx = 1.0, fy = 0

			// Superpose dipole-like deflections from every obstacle
			for (let oy = 0; oy < H; oy++) {
				for (let ox = 0; ox < W; ox++) {
					if (obstacles[oy * W + ox] !== WALL) continue
					let ddx = x - ox
					let ddy = y - oy
					if (ddx > W / 2) ddx -= W
					if (ddx < -W / 2) ddx += W
					const distSq = ddx * ddx + ddy * ddy
					if (distSq < 0.5) continue
					const s = 3.0 / distSq
					fx += ddx * s
					fy += ddy * s
				}
			}

			const mag = Math.sqrt(fx * fx + fy * fy) || 1
			vx[i] = fx / mag
			vy[i] = fy / mag
		}
	}
	fieldDirty = false
}

// ── Particles / streamlines ─────────────────────────────────────────────────

function initParticles() {
	const n = params.lines.value
	particles = []
	for (let i = 0; i < n; i++) particles.push(makeParticle(i, n))
}

function makeParticle(index, total) {
	return {
		x: Math.random() * 2,
		y: ((index + 0.5) / total) * H,
		hue: (index / total) * 300,      // spread across the hue wheel
		trail: [],
	}
}

function sampleField(px, py) {
	px = ((px % W) + W) % W
	py = ((py % H) + H) % H
	const x0 = Math.floor(px), y0 = Math.floor(py)
	const x1 = (x0 + 1) % W,  y1 = (y0 + 1) % H
	const fx = px - x0, fy = py - y0

	const i00 = y0 * W + x0, i10 = y0 * W + x1
	const i01 = y1 * W + x0, i11 = y1 * W + x1

	const bilerp = (f) =>
		f[i00] * (1 - fx) * (1 - fy) +
		f[i10] * fx * (1 - fy) +
		f[i01] * (1 - fx) * fy +
		f[i11] * fx * fy

	return { vx: bilerp(vx), vy: bilerp(vy) }
}

// ── Interaction ─────────────────────────────────────────────────────────────

export function onCanvasInteract(x, y, mode) {
	if (!obstacles) return
	if (x < 0 || x >= W || y < 0 || y >= H) return
	const i = y * W + x
	if (mode === 'place') {
		obstacles[i] = WALL
	} else {
		obstacles[i] = 0
	}
	fieldDirty = true
}

// ── Draw ────────────────────────────────────────────────────────────────────

export function draw(ctx, frame, cW, cH) {
	if (!obstacles) setup(cW, cH)
	if (fieldDirty) buildField()

	const spd = params.speed.value
	const numLines = params.lines.value
	const trailLen = W + 10

	// Keep particle count in sync with slider
	while (particles.length < numLines) particles.push(makeParticle(particles.length, numLines))
	while (particles.length > numLines) particles.pop()

	// Advect particles (RK-2 integration)
	for (let pi = 0; pi < particles.length; pi++) {
		const p = particles[pi]
		const v1 = sampleField(p.x, p.y)
		const v2 = sampleField(p.x + v1.vx * spd * 0.5, p.y + v1.vy * spd * 0.5)
		p.x += v2.vx * spd
		p.y += v2.vy * spd

		// Record trail pixel
		const gx = Math.floor(((p.x % W) + W) % W)
		const gy = Math.floor(((p.y % H) + H) % H)
		p.trail.push({ x: gx, y: gy, mag: Math.sqrt(v2.vx * v2.vx + v2.vy * v2.vy) })
		if (p.trail.length > trailLen) p.trail.shift()

		// Respawn at left edge when exiting right
		if (p.x > W + 2 || p.x < -2) {
			p.x = 0
			p.y = ((pi + 0.5) / particles.length) * H
			p.trail = []
		}
	}

	// ── Render ──────────────────────────────────────────────────────────
	const imgData = ctx.createImageData(cW, cH)
	const d = imgData.data

	// Black background
	for (let i = 0; i < d.length; i += 4) {
		d[i] = 2; d[i + 1] = 2; d[i + 2] = 6; d[i + 3] = 255
	}

	// Obstacles — single white dots
	for (let y = 0; y < H; y++) {
		for (let x = 0; x < W; x++) {
			if (obstacles[y * W + x] === WALL) {
				const j = (y * W + x) * 4
				d[j] = 255; d[j + 1] = 255; d[j + 2] = 255
			}
		}
	}

	// Streamlines — 1px wide, hue encodes velocity
	for (const p of particles) {
		const len = p.trail.length
		for (let t = 0; t < len; t++) {
			const pt = p.trail[t]
			const j = (pt.y * W + pt.x) * 4

			const age = t / len                         // 0 old → 1 new
			const brightness = 0.25 + age * 0.55        // fade tail

			// Hue: base from line identity, shifted by local velocity magnitude
			// Low speed → blue (≈220°), high speed near obstacles → red/orange
			const velHue = (1 - Math.min(pt.mag, 1.5) / 1.5) * 220
			const hue = (velHue + p.hue * 0.15 + frame * 0.4) % 360

			const rgb = hsl(hue / 360, 0.9, brightness)
			// Additive-ish blend: keep brightest value per pixel
			if (rgb[0] > d[j])     d[j]     = rgb[0]
			if (rgb[1] > d[j + 1]) d[j + 1] = rgb[1]
			if (rgb[2] > d[j + 2]) d[j + 2] = rgb[2]
		}
	}

	ctx.putImageData(imgData, 0, 0)
}

// ── HSL → RGB ───────────────────────────────────────────────────────────────
function hsl(h, s, l) {
	let r, g, b
	if (s === 0) { r = g = b = l } else {
		const hue2rgb = (p, q, t) => {
			if (t < 0) t += 1; if (t > 1) t -= 1
			if (t < 1 / 6) return p + (q - p) * 6 * t
			if (t < 1 / 2) return q
			if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6
			return p
		}
		const q = l < 0.5 ? l * (1 + s) : l + s - l * s
		const p = 2 * l - q
		r = hue2rgb(p, q, h + 1 / 3)
		g = hue2rgb(p, q, h)
		b = hue2rgb(p, q, h - 1 / 3)
	}
	return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)]
}
