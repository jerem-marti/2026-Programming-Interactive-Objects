/**
 * Face Renderer module — renders a face onto the 32×32 pixel canvas.
 *
 * Two rendering modes:
 *   1. PHOTO mode: crops the webcam face region (using the mesh bounding box)
 *      and scales it to fill the full 32×32 grid.
 *   2. PIXEL-ART mode: draws a stylized pixel-art face driven by
 *      the expression metrics from faceMesh.js, producing a cartoon
 *      avatar that mimics the user.
 *
 * Both modes output a 32×32 ImageData suitable for dithering.
 */

const MATRIX_SIZE = 32

// ─── Offscreen canvas for cropping ──────────────────────────────────────────

const cropCanvas = document.createElement('canvas')
cropCanvas.width  = MATRIX_SIZE
cropCanvas.height = MATRIX_SIZE
const cropCtx = cropCanvas.getContext('2d', { willReadFrequently: true })

// ─── PHOTO MODE ─────────────────────────────────────────────────────────────

/**
 * Crop the detected face region from the video and scale to 32×32.
 *
 * @param {HTMLVideoElement} video  — the live webcam feed
 * @param {object}           face   — expression data from faceMesh.detectFace()
 * @param {CanvasRenderingContext2D} ctx — destination 32×32 canvas context
 * @returns {ImageData} 32×32 RGBA
 */
export function renderPhotoCrop(video, face, ctx) {
	const { x, y, w, h } = face.faceBox

	ctx.clearRect(0, 0, MATRIX_SIZE, MATRIX_SIZE)
	ctx.drawImage(video, x, y, w, h, 0, 0, MATRIX_SIZE, MATRIX_SIZE)
	return ctx.getImageData(0, 0, MATRIX_SIZE, MATRIX_SIZE)
}

/**
 * Fallback: capture center-square from the video (no face detected).
 *
 * @param {HTMLVideoElement} video
 * @param {CanvasRenderingContext2D} ctx
 * @returns {ImageData}
 */
export function renderFullFrame(video, ctx) {
	const vw = video.videoWidth
	const vh = video.videoHeight
	const size = Math.min(vw, vh)
	const sx = (vw - size) / 2
	const sy = (vh - size) / 2

	ctx.clearRect(0, 0, MATRIX_SIZE, MATRIX_SIZE)
	ctx.drawImage(video, sx, sy, size, size, 0, 0, MATRIX_SIZE, MATRIX_SIZE)
	return ctx.getImageData(0, 0, MATRIX_SIZE, MATRIX_SIZE)
}

// ─── PIXEL-ART MODE ─────────────────────────────────────────────────────────

/**
 * Color palette for the pixel-art face.
 */
const PALETTE = {
	bg:         '#1a1a2e',
	skin:       '#f5c6a0',
	skinDark:   '#d9a07a',
	skinLight:  '#ffe0c0',
	eyeWhite:   '#ffffff',
	iris:       '#4a3728',
	pupil:      '#111111',
	mouth:      '#c0392b',
	mouthDark:  '#8b1a1a',
	teeth:      '#f0f0f0',
	brow:       '#5a3825',
	nose:       '#d9a07a',
	hair:       '#3a2510',
	outline:    '#2c1810'
}

/**
 * Draw a stylized pixel-art face driven by expression metrics.
 * The face fills the full 32×32 grid and mimics the user's expression.
 *
 * @param {object} face — expression data from faceMesh.detectFace()
 * @param {CanvasRenderingContext2D} ctx — destination 32×32 canvas context
 * @returns {ImageData} 32×32 RGBA
 */
export function renderPixelArt(face, ctx) {
	const {
		leftEyeOpen, rightEyeOpen,
		mouthOpen, mouthWidth,
		leftBrowRaise, rightBrowRaise,
		headYaw, headPitch
	} = face

	// Use blendshapes for extra precision if available
	const bs = face.blendshapes || {}

	ctx.clearRect(0, 0, MATRIX_SIZE, MATRIX_SIZE)

	// ── Background ──────────────────────────────────────────────────────
	fillRect(ctx, 0, 0, 32, 32, PALETTE.bg)

	// ── Head shift based on yaw / pitch ─────────────────────────────────
	const dx = Math.round(clamp(headYaw * 3, -3, 3))
	const dy = Math.round(clamp(headPitch * 3, -2, 2))

	// ── Face oval (fill) ────────────────────────────────────────────────
	drawFaceOval(ctx, dx, dy)

	// ── Eyebrows ────────────────────────────────────────────────────────
	const lBrow = Math.round(lerp(0, -2, clamp(leftBrowRaise, 0, 1)))
	const rBrow = Math.round(lerp(0, -2, clamp(rightBrowRaise, 0, 1)))
	drawBrow(ctx, 8  + dx, 9 + dy + lBrow, false)  // left brow
	drawBrow(ctx, 19 + dx, 9 + dy + rBrow, true)   // right brow

	// ── Eyes ────────────────────────────────────────────────────────────
	drawEye(ctx, 10 + dx, 13 + dy, leftEyeOpen, bs)
	drawEye(ctx, 20 + dx, 13 + dy, rightEyeOpen, bs)

	// ── Nose ────────────────────────────────────────────────────────────
	drawNose(ctx, 15 + dx, 18 + dy)

	// ── Mouth ───────────────────────────────────────────────────────────
	drawMouth(ctx, 15 + dx, 23 + dy, mouthOpen, mouthWidth, bs)

	return ctx.getImageData(0, 0, MATRIX_SIZE, MATRIX_SIZE)
}

// ─── Drawing primitives ─────────────────────────────────────────────────────

function fillRect(ctx, x, y, w, h, color) {
	ctx.fillStyle = color
	ctx.fillRect(Math.round(x), Math.round(y), w, h)
}

function setPixel(ctx, x, y, color) {
	ctx.fillStyle = color
	ctx.fillRect(Math.round(x), Math.round(y), 1, 1)
}

// ─── Face oval ──────────────────────────────────────────────────────────────

function drawFaceOval(ctx, dx, dy) {
	// Simple ellipse approximation using rows
	const cx = 15.5 + dx
	const cy = 16 + dy
	const rx = 11  // horizontal radius
	const ry = 13  // vertical radius

	for (let py = 0; py < 32; py++) {
		for (let px = 0; px < 32; px++) {
			const nx = (px - cx) / rx
			const ny = (py - cy) / ry
			const d = nx * nx + ny * ny
			if (d < 1.0) {
				// Inside the face oval
				const shade = d > 0.85 ? PALETTE.skinDark : (d < 0.4 ? PALETTE.skinLight : PALETTE.skin)
				setPixel(ctx, px, py, shade)
			} else if (d < 1.15) {
				// Outline
				setPixel(ctx, px, py, PALETTE.outline)
			}
		}
	}

	// Hair (top of head)
	for (let px = 0; px < 32; px++) {
		for (let py = 0; py < 6 + dy; py++) {
			const nx = (px - cx) / (rx + 1)
			const ny = (py - cy) / (ry + 2)
			if (nx * nx + ny * ny < 1.0) {
				setPixel(ctx, px, py, PALETTE.hair)
			}
		}
	}
}

// ─── Eyebrow ────────────────────────────────────────────────────────────────

function drawBrow(ctx, cx, cy, mirrored) {
	const dir = mirrored ? -1 : 1
	for (let i = -2; i <= 2; i++) {
		const yOff = Math.abs(i) === 2 ? 1 : 0
		setPixel(ctx, cx + i * dir, cy + yOff, PALETTE.brow)
	}
}

// ─── Eye ────────────────────────────────────────────────────────────────────

function drawEye(ctx, cx, cy, openness, blendshapes) {
	// openness: 0 = closed, 1 = fully open
	const open = clamp(openness, 0, 1)

	if (open < 0.15) {
		// Eye closed — horizontal line
		for (let i = -2; i <= 2; i++) {
			setPixel(ctx, cx + i, cy, PALETTE.outline)
		}
	} else if (open < 0.5) {
		// Half open — squinted
		for (let i = -2; i <= 2; i++) {
			setPixel(ctx, cx + i, cy - 1, PALETTE.outline)
			setPixel(ctx, cx + i, cy,     PALETTE.eyeWhite)
			setPixel(ctx, cx + i, cy + 1, PALETTE.outline)
		}
		// Iris
		setPixel(ctx, cx, cy, PALETTE.iris)
	} else {
		// Fully open
		// White
		for (let i = -2; i <= 2; i++) {
			setPixel(ctx, cx + i, cy - 1, PALETTE.eyeWhite)
			setPixel(ctx, cx + i, cy,     PALETTE.eyeWhite)
			setPixel(ctx, cx + i, cy + 1, PALETTE.eyeWhite)
		}
		// Outline
		for (let i = -2; i <= 2; i++) {
			setPixel(ctx, cx + i, cy - 2, PALETTE.outline)
			setPixel(ctx, cx + i, cy + 2, PALETTE.outline)
		}
		setPixel(ctx, cx - 3, cy - 1, PALETTE.outline)
		setPixel(ctx, cx - 3, cy,     PALETTE.outline)
		setPixel(ctx, cx - 3, cy + 1, PALETTE.outline)
		setPixel(ctx, cx + 3, cy - 1, PALETTE.outline)
		setPixel(ctx, cx + 3, cy,     PALETTE.outline)
		setPixel(ctx, cx + 3, cy + 1, PALETTE.outline)

		// Iris (2×2) + pupil
		setPixel(ctx, cx,     cy,     PALETTE.pupil)
		setPixel(ctx, cx + 1, cy,     PALETTE.iris)
		setPixel(ctx, cx,     cy + 1, PALETTE.iris)
		setPixel(ctx, cx + 1, cy + 1, PALETTE.iris)
	}
}

// ─── Nose ───────────────────────────────────────────────────────────────────

function drawNose(ctx, cx, cy) {
	setPixel(ctx, cx,     cy,     PALETTE.nose)
	setPixel(ctx, cx + 1, cy,     PALETTE.nose)
	setPixel(ctx, cx - 1, cy + 1, PALETTE.outline)
	setPixel(ctx, cx,     cy + 1, PALETTE.nose)
	setPixel(ctx, cx + 1, cy + 1, PALETTE.nose)
	setPixel(ctx, cx + 2, cy + 1, PALETTE.outline)
}

// ─── Mouth ──────────────────────────────────────────────────────────────────

function drawMouth(ctx, cx, cy, openness, width, blendshapes) {
	const open = clamp(openness, 0, 1)
	const w    = clamp(width, 0.3, 1.0)

	// Half-width in pixels (3–6)
	const hw = Math.round(lerp(3, 6, w))

	// Detect smile from blendshapes
	const smileL = blendshapes.mouthSmileLeft  || 0
	const smileR = blendshapes.mouthSmileRight || 0
	const smile  = (smileL + smileR) / 2

	if (open < 0.15) {
		// Closed mouth — line, possibly curved up for smile
		for (let i = -hw; i <= hw; i++) {
			const curveY = smile > 0.3 ? Math.round(Math.abs(i) / hw * 1.5) : 0
			setPixel(ctx, cx + i, cy - curveY, PALETTE.mouth)
		}
	} else {
		// Open mouth
		const mouthH = Math.round(lerp(1, 4, open))

		// Outer outline
		for (let i = -hw; i <= hw; i++) {
			setPixel(ctx, cx + i, cy - 1,          PALETTE.outline)
			setPixel(ctx, cx + i, cy + mouthH,     PALETTE.outline)
		}
		setPixel(ctx, cx - hw - 1, cy,             PALETTE.outline)
		setPixel(ctx, cx + hw + 1, cy,             PALETTE.outline)

		// Mouth interior
		for (let j = 0; j < mouthH; j++) {
			for (let i = -hw; i <= hw; i++) {
				const color = j === 0 ? PALETTE.teeth : PALETTE.mouthDark
				setPixel(ctx, cx + i, cy + j, color)
			}
		}

		// Lip color on top and bottom edges
		for (let i = -hw + 1; i <= hw - 1; i++) {
			setPixel(ctx, cx + i, cy - 1,      PALETTE.mouth)
			setPixel(ctx, cx + i, cy + mouthH, PALETTE.mouth)
		}
	}
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)) }
function lerp(a, b, t) { return a + (b - a) * t }
