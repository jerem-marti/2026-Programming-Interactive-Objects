/**
 * 3D SDF raymarching engine for 32×32 LED matrix.
 *
 * Renders a "living presence object" using sphere tracing against
 * a signed distance field. At 1024 pixels, full raymarching is
 * comfortably real-time in JavaScript.
 *
 * Features:
 *   - Multiple base shapes (metaball, torus+sphere, rounded box)
 *   - Domain warping for organic feel
 *   - Smooth union / subtraction for morphing
 *   - Internal "core" for charging state
 *   - Event memory as fading scars (bubbles / cavities)
 *   - Ordered dithering for limited-palette LED output
 *   - Simple diffuse + ambient lighting
 */

const SIZE = 32
const MAX_STEPS = 48
const MAX_DIST = 6.0
const SURF_DIST = 0.02
const PI = Math.PI
const TAU = PI * 2

// ─── Bayer 4×4 dithering matrix ──────────────────────────────────────────────

const BAYER4 = [
	 0,  8,  2, 10,
	12,  4, 14,  6,
	 3, 11,  1,  9,
	15,  7, 13,  5
].map(v => v / 16.0 - 0.5)

// ─── Scene parameters (driven externally) ────────────────────────────────────

/** @type {'metaball'|'torus'|'roundbox'} */
let baseShape = 'torus'

let params = {
	// Time (set externally each frame)
	time: 0,

	// Ambient drift
	rotSpeed: 0.3,
	warpAmount: 0.2,
	breathe: 0,       // 0..1, slow sine

	// Gesture-driven
	handDir: { x: 0, y: 0 },   // -1..1, attractor direction
	attention: 0,               // 0..1, how much the object "leans"

	// Charging
	coreEnergy: 0,              // 0..1, inner core intensity
	coreFocus: 0,               // 0..1, surface tightening

	// Release shockwave
	shockwave: 0,               // 0..1, resonance ring expanding inward
	shockPhase: 0,              // radians, where in the shockwave anim

	// Bloom flash
	bloom: 0,                   // 0..1, bright flash on release

	// Receiving
	remoteCore: 0,              // 0..1, second core from remote
	remoteSeed: 0,              // int, shapes the remote core path
	remotePhase: 0,             // 0..1, merge travel progress

	// Sync moment
	syncLock: 0,                // 0..1, perfect symmetry lock

	// Dithering
	ditherAmount: 0.5,

	// Palette
	baseHue: 0.6,               // 0..1 hue
}

// ─── Memory: event scars ─────────────────────────────────────────────────────

/** @type {Array<{ seed: number, energy: number, age: number, maxAge: number }>} */
let scars = []
const MAX_SCARS = 8

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Set the base shape type.
 * @param {'metaball'|'torus'|'roundbox'} shape
 */
export function setShape(shape) {
	baseShape = shape
}

/**
 * Get current params object for external mutation.
 * @returns {object}
 */
export function getParams() {
	return params
}

/**
 * Add a scar (event memory) to the scene.
 * @param {number} seed
 * @param {number} energy - 0..1
 * @param {number} maxAge - seconds before fully faded
 */
export function addScar(seed, energy, maxAge = 3600) {
	scars.push({ seed, energy, age: 0, maxAge })
	if (scars.length > MAX_SCARS) scars.shift()
}

/**
 * Get current scars list for UI display.
 * @returns {Array}
 */
export function getScars() {
	return scars
}

/**
 * Render one frame into the provided ImageData (32×32 RGBA).
 * @param {ImageData} imageData
 * @param {number} dt - delta time in seconds
 */
export function render(imageData, dt) {
	const data = imageData.data
	const t = params.time

	// Update breathe
	params.breathe = Math.sin(t * 0.5) * 0.5 + 0.5

	// Age scars
	for (let i = scars.length - 1; i >= 0; i--) {
		scars[i].age += dt
		if (scars[i].age >= scars[i].maxAge) {
			scars.splice(i, 1)
		}
	}

	// Camera setup — orbiting slightly
	const camDist = 3.5
	const camAngle = t * params.rotSpeed * 0.3
	const camY = 0.3 + Math.sin(t * 0.2) * 0.15
	const camX = Math.sin(camAngle) * camDist
	const camZ = Math.cos(camAngle) * camDist
	const ro = [camX, camY, camZ]     // ray origin
	const ta = [0, 0, 0]               // look-at target

	// Camera matrix (look-at)
	const fwd = normalize(sub(ta, ro))
	const right = normalize(cross(fwd, [0, 1, 0]))
	const up = cross(right, fwd)

	for (let py = 0; py < SIZE; py++) {
		for (let px = 0; px < SIZE; px++) {
			// Normalized coords: -1..1
			const u = (2 * (px + 0.5) / SIZE - 1)
			const v = -(2 * (py + 0.5) / SIZE - 1) // flip Y

			// Ray direction
			const rd = normalize([
				right[0] * u + up[0] * v + fwd[0] * 1.2,
				right[1] * u + up[1] * v + fwd[1] * 1.2,
				right[2] * u + up[2] * v + fwd[2] * 1.2
			])

			// Raymarch
			const hit = raymarch(ro, rd, t)

			let r, g, b

			if (hit.hit) {
				// Compute normal
				const n = getNormal(hit.p, t)

				// Lighting
				const lightDir = normalize([0.5, 0.8, 0.6])
				const diff = Math.max(dot(n, lightDir), 0)
				const ambient = 0.15
				const spec = Math.pow(Math.max(dot(reflect(neg(lightDir), n), neg(rd)), 0), 16) * 0.3

				let lum = ambient + diff * 0.7 + spec

				// Material color — based on position + hue
				const hue = params.baseHue + hit.p[1] * 0.1 + Math.sin(t * 0.3) * 0.05
				const sat = 0.5 + params.coreFocus * 0.3
				const val = lum

				// Core glow — inner bright spot during charging
				if (params.coreEnergy > 0.01) {
					const coreDist = length(hit.p)
					const coreRadius = 0.15 + params.coreEnergy * 0.4
					const coreGlow = smoothstep(coreRadius + 0.2, coreRadius - 0.05, coreDist)
					lum += coreGlow * params.coreEnergy * 1.5
				}

				// Remote core glow
				if (params.remoteCore > 0.01) {
					const rSeed = params.remoteSeed
					const rPhase = params.remotePhase
					const rcPos = [
						Math.sin(rSeed * 1.7) * (1 - rPhase) * 1.2,
						Math.cos(rSeed * 2.3) * (1 - rPhase) * 0.8,
						Math.sin(rSeed * 0.9) * (1 - rPhase) * 1.0
					]
					const rcDist = length(sub(hit.p, rcPos))
					const rcGlow = smoothstep(0.4, 0.0, rcDist) * params.remoteCore
					lum += rcGlow * 1.2
				}

				// Shockwave ring
				if (params.shockwave > 0.01) {
					const distFromCenter = length(hit.p)
					const ringPos = params.shockPhase * 1.5
					const ring = smoothstep(0.15, 0.0, Math.abs(distFromCenter - ringPos))
					lum += ring * params.shockwave * 0.8
				}

				// Bloom flash
				lum += params.bloom * 0.6

				// Sync lock — crisp white
				if (params.syncLock > 0.5) {
					const syncFactor = (params.syncLock - 0.5) * 2
					const c = hslToRgb(hue, sat * (1 - syncFactor * 0.8), Math.min(lum, 1))
					r = c[0]
					g = c[1]
					b = c[2]
				} else {
					const c = hslToRgb(hue, sat, Math.min(lum, 1))
					r = c[0]
					g = c[1]
					b = c[2]
				}

				// Scar highlights — faint glints from past events
				for (const scar of scars) {
					const fade = 1 - scar.age / scar.maxAge
					if (fade <= 0) continue
					const scarPos = [
						Math.sin(scar.seed * 2.1) * 0.5,
						Math.cos(scar.seed * 1.3) * 0.4,
						Math.sin(scar.seed * 3.7) * 0.5
					]
					const scarDist = length(sub(hit.p, scarPos))
					const scarGlow = smoothstep(0.25, 0.05, scarDist) * fade * scar.energy * 0.3
					r += scarGlow * 80
					g += scarGlow * 60
					b += scarGlow * 90
				}
			} else {
				// Background — very dark with subtle gradient
				const bgLum = 0.01 + Math.max(0, v * 0.02)
				r = bgLum * 20
				g = bgLum * 15
				b = bgLum * 40
			}

			// ── Ordered dithering ────────────────────────────────────────
			if (params.ditherAmount > 0.01) {
				const bayerIdx = (px % 4) + (py % 4) * 4
				const dither = BAYER4[bayerIdx] * params.ditherAmount * 40
				r += dither
				g += dither
				b += dither
			}

			// Clamp & write
			const idx = (py * SIZE + px) * 4
			data[idx + 0] = clamp(Math.round(r), 0, 255)
			data[idx + 1] = clamp(Math.round(g), 0, 255)
			data[idx + 2] = clamp(Math.round(b), 0, 255)
			data[idx + 3] = 255
		}
	}
}

// ─── Raymarching ─────────────────────────────────────────────────────────────

/**
 * Sphere-trace through the scene.
 * @returns {{ hit: boolean, p: number[], dist: number, steps: number }}
 */
function raymarch(ro, rd, t) {
	let totalDist = 0
	for (let i = 0; i < MAX_STEPS; i++) {
		const p = add(ro, scale(rd, totalDist))
		const d = sceneSDF(p, t)
		if (d < SURF_DIST) {
			return { hit: true, p, dist: totalDist, steps: i }
		}
		totalDist += d
		if (totalDist > MAX_DIST) break
	}
	return { hit: false, p: [0, 0, 0], dist: MAX_DIST, steps: MAX_STEPS }
}

/**
 * Compute surface normal via central differences.
 */
function getNormal(p, t) {
	const e = 0.01
	const d = sceneSDF(p, t)
	return normalize([
		sceneSDF([p[0] + e, p[1], p[2]], t) - d,
		sceneSDF([p[0], p[1] + e, p[2]], t) - d,
		sceneSDF([p[0], p[1], p[2] + e], t) - d
	])
}

// ─── Scene SDF ───────────────────────────────────────────────────────────────

function sceneSDF(p, t) {
	// Domain warp for organic feel
	let wp = [...p]
	if (params.warpAmount > 0.001) {
		const w = params.warpAmount * 0.3
		wp[0] += Math.sin(p[1] * 3 + t * 0.7) * w
		wp[1] += Math.sin(p[2] * 3 + t * 0.5) * w
		wp[2] += Math.sin(p[0] * 3 + t * 0.6) * w
	}

	// Attention: lean toward hand direction
	if (params.attention > 0.01) {
		const lean = params.attention * 0.3
		wp[0] -= params.handDir.x * lean
		wp[1] -= params.handDir.y * lean
	}

	// Breathe: gentle scale oscillation
	const breathScale = 1.0 + params.breathe * 0.08
	wp[0] /= breathScale
	wp[1] /= breathScale
	wp[2] /= breathScale

	let d

	switch (baseShape) {
		case 'metaball':
			d = metaballScene(wp, t)
			break
		case 'torus':
			d = torusScene(wp, t)
			break
		case 'roundbox':
			d = roundboxScene(wp, t)
			break
		default:
			d = torusScene(wp, t)
	}

	// Scale correction for breathe
	d *= breathScale

	// Core cavity (charging) — a small sphere that "forms inside"
	if (params.coreEnergy > 0.01) {
		const coreRadius = 0.1 + params.coreEnergy * 0.35
		const coreSdf = sdSphere(p, coreRadius) // not warped — so it feels internal
		// Smooth intersect: the core tightens the surface
		d = smoothSubtraction(coreSdf - 0.1, d, 0.15 * params.coreEnergy)
	}

	// Shockwave carving
	if (params.shockwave > 0.01) {
		const distFromCenter = length(p)
		const ringPos = params.shockPhase * 1.5
		const ringSdf = Math.abs(distFromCenter - ringPos) - 0.02
		d = smoothSubtraction(ringSdf, d, 0.1 * params.shockwave)
	}

	// Sync lock: morph toward perfect torus
	if (params.syncLock > 0.01) {
		const perfectTorus = sdTorus(p, 0.6, 0.2)
		d = mix(d, perfectTorus, params.syncLock)
	}

	// Scar cavities — tiny bubbles from past events
	for (const scar of scars) {
		const fade = 1 - scar.age / scar.maxAge
		if (fade <= 0.01) continue
		const scarPos = [
			Math.sin(scar.seed * 2.1) * 0.5,
			Math.cos(scar.seed * 1.3) * 0.4,
			Math.sin(scar.seed * 3.7) * 0.5
		]
		const scarRadius = 0.05 + scar.energy * 0.1 * fade
		const scarSdf = sdSphere(sub(p, scarPos), scarRadius)
		d = smoothSubtraction(scarSdf, d, 0.08 * fade)
	}

	// Remote core (arriving event)
	if (params.remoteCore > 0.01) {
		const rSeed = params.remoteSeed
		const rPhase = params.remotePhase
		const rcPos = [
			Math.sin(rSeed * 1.7) * (1 - rPhase) * 1.2,
			Math.cos(rSeed * 2.3) * (1 - rPhase) * 0.8,
			Math.sin(rSeed * 0.9) * (1 - rPhase) * 1.0
		]
		const rcRadius = 0.08 + params.remoteCore * 0.15
		const rcSdf = sdSphere(sub(p, rcPos), rcRadius)
		d = smoothUnion(d, rcSdf, 0.2 * params.remoteCore)
	}

	return d
}

// ─── Shape scenes ────────────────────────────────────────────────────────────

function metaballScene(p, t) {
	// 3 soft blobs orbiting
	const d1 = sdSphere(sub(p, [
		Math.sin(t * 0.4) * 0.5,
		Math.cos(t * 0.3) * 0.3,
		Math.sin(t * 0.5) * 0.4
	]), 0.35)

	const d2 = sdSphere(sub(p, [
		Math.cos(t * 0.35) * 0.4,
		Math.sin(t * 0.45) * 0.35,
		Math.cos(t * 0.25) * 0.5
	]), 0.3)

	const d3 = sdSphere(sub(p, [
		Math.sin(t * 0.5 + 2) * 0.35,
		Math.cos(t * 0.4 + 1) * 0.25,
		Math.sin(t * 0.3 + 3) * 0.35
	]), 0.28)

	return smoothUnion(smoothUnion(d1, d2, 0.4), d3, 0.4)
}

function torusScene(p, t) {
	// Torus + inner sphere
	const torusDist = sdTorus(p, 0.55 + Math.sin(t * 0.3) * 0.05, 0.18)
	const sphereDist = sdSphere(p, 0.25 + Math.sin(t * 0.5) * 0.05)
	return smoothUnion(torusDist, sphereDist, 0.3)
}

function roundboxScene(p, t) {
	// Rounded box morphing toward sphere
	const morph = Math.sin(t * 0.25) * 0.5 + 0.5
	const boxDist = sdRoundBox(p, [0.4, 0.35, 0.4], 0.1 + morph * 0.2)
	const sphereDist = sdSphere(p, 0.45)
	return mix(boxDist, sphereDist, morph * 0.3)
}

// ─── SDF primitives ──────────────────────────────────────────────────────────

function sdSphere(p, r) {
	return length(p) - r
}

function sdTorus(p, R, r) {
	const qx = Math.sqrt(p[0] * p[0] + p[2] * p[2]) - R
	return Math.sqrt(qx * qx + p[1] * p[1]) - r
}

function sdRoundBox(p, b, r) {
	const q = [
		Math.abs(p[0]) - b[0],
		Math.abs(p[1]) - b[1],
		Math.abs(p[2]) - b[2]
	]
	return length([
		Math.max(q[0], 0),
		Math.max(q[1], 0),
		Math.max(q[2], 0)
	]) + Math.min(Math.max(q[0], Math.max(q[1], q[2])), 0) - r
}

// ─── SDF operations ──────────────────────────────────────────────────────────

function smoothUnion(d1, d2, k) {
	const h = clamp(0.5 + 0.5 * (d2 - d1) / k, 0, 1)
	return mix(d2, d1, h) - k * h * (1 - h)
}

function smoothSubtraction(d1, d2, k) {
	const h = clamp(0.5 - 0.5 * (d2 + d1) / k, 0, 1)
	return mix(d2, -d1, h) + k * h * (1 - h)
}

// ─── Vector math (3-component arrays) ────────────────────────────────────────

function add(a, b) { return [a[0] + b[0], a[1] + b[1], a[2] + b[2]] }
function sub(a, b) { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]] }
function scale(a, s) { return [a[0] * s, a[1] * s, a[2] * s] }
function neg(a) { return [-a[0], -a[1], -a[2]] }
function dot(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2] }
function cross(a, b) {
	return [
		a[1] * b[2] - a[2] * b[1],
		a[2] * b[0] - a[0] * b[2],
		a[0] * b[1] - a[1] * b[0]
	]
}
function length(a) { return Math.sqrt(a[0] * a[0] + a[1] * a[1] + a[2] * a[2]) }
function normalize(a) {
	const l = length(a)
	return l > 0.0001 ? [a[0] / l, a[1] / l, a[2] / l] : [0, 0, 0]
}
function reflect(I, N) {
	const d = 2 * dot(I, N)
	return [I[0] - N[0] * d, I[1] - N[1] * d, I[2] - N[2] * d]
}

// ─── Scalar math ─────────────────────────────────────────────────────────────

function clamp(x, lo, hi) { return x < lo ? lo : (x > hi ? hi : x) }
function mix(a, b, t) { return a + (b - a) * t }
function smoothstep(e0, e1, x) {
	const t = clamp((x - e0) / (e1 - e0), 0, 1)
	return t * t * (3 - 2 * t)
}

// ─── Color ───────────────────────────────────────────────────────────────────

/**
 * HSL to RGB (all 0..1 inputs, returns [0..255, 0..255, 0..255])
 */
function hslToRgb(h, s, l) {
	h = ((h % 1) + 1) % 1
	s = clamp(s, 0, 1)
	l = clamp(l, 0, 1)

	const a = s * Math.min(l, 1 - l)
	const f = (n) => {
		const k = (n + h * 12) % 12
		return l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))
	}

	return [
		Math.round(f(0) * 255),
		Math.round(f(8) * 255),
		Math.round(f(4) * 255)
	]
}
