/**
 * Drawing module — manages the 32x32 pixel canvas with time-based fading.
 *
 * Each pixel stores its RGB color and a timestamp of when it was drawn.
 * Pixels older than the configured timeout fade out and are cleared.
 * The module produces an ImageData suitable for serial transmission.
 */

const MATRIX_SIZE = 32

/**
 * @typedef {Object} Pixel
 * @property {number} r - Red channel (0–255)
 * @property {number} g - Green channel (0–255)
 * @property {number} b - Blue channel (0–255)
 * @property {number} t - Timestamp when the pixel was drawn (ms)
 */

/** @type {Pixel[]} Flat array of pixels, row-major order */
const pixels = new Array(MATRIX_SIZE * MATRIX_SIZE)

/** Fade timeout in seconds */
let fadeTimeout = 5

/** Brush size in pixels (radius) */
let brushSize = 1

/** Current drawing color */
let brushColor = { r: 255, g: 255, b: 255 }

// Initialize all pixels as empty
clearAll()

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Set the fade timeout duration.
 * @param {number} seconds - Time before a pixel fades out
 */
export function setFadeTimeout(seconds) {
	fadeTimeout = seconds
}

/**
 * Get the current fade timeout.
 * @returns {number}
 */
export function getFadeTimeout() {
	return fadeTimeout
}

/**
 * Set the brush color.
 * @param {number} r - Red (0–255)
 * @param {number} g - Green (0–255)
 * @param {number} b - Blue (0–255)
 */
export function setBrushColor(r, g, b) {
	brushColor = { r, g, b }
}

/**
 * Get the current brush color.
 * @returns {{ r: number, g: number, b: number }}
 */
export function getBrushColor() {
	return { ...brushColor }
}

/**
 * Set the brush size (radius in pixels).
 * @param {number} size
 */
export function setBrushSize(size) {
	brushSize = Math.max(1, Math.min(8, size))
}

/**
 * Get the current brush size.
 * @returns {number}
 */
export function getBrushSize() {
	return brushSize
}

/**
 * Draw a point at (x, y) using the current brush color and size.
 * @param {number} cx - X coordinate (0–31)
 * @param {number} cy - Y coordinate (0–31)
 */
export function drawPoint(cx, cy) {
	const now = performance.now()
	const r = brushSize - 1

	for (let dy = -r; dy <= r; dy++) {
		for (let dx = -r; dx <= r; dx++) {
			// Circle brush: skip corners outside the radius
			if (dx * dx + dy * dy > r * r + r) continue

			const px = cx + dx
			const py = cy + dy
			if (px < 0 || px >= MATRIX_SIZE || py < 0 || py >= MATRIX_SIZE) continue

			const idx = py * MATRIX_SIZE + px
			pixels[idx] = {
				r: brushColor.r,
				g: brushColor.g,
				b: brushColor.b,
				t: now
			}
		}
	}
}

/**
 * Draw a line between two points using Bresenham's algorithm.
 * This ensures smooth strokes even with fast hand movement.
 * @param {number} x0
 * @param {number} y0
 * @param {number} x1
 * @param {number} y1
 */
export function drawLine(x0, y0, x1, y1) {
	const dx = Math.abs(x1 - x0)
	const dy = Math.abs(y1 - y0)
	const sx = x0 < x1 ? 1 : -1
	const sy = y0 < y1 ? 1 : -1
	let err = dx - dy

	while (true) {
		drawPoint(x0, y0)

		if (x0 === x1 && y0 === y1) break
		const e2 = 2 * err
		if (e2 > -dy) { err -= dy; x0 += sx }
		if (e2 < dx)  { err += dx; y0 += sy }
	}
}

/**
 * Clear all pixels.
 */
export function clearAll() {
	for (let i = 0; i < MATRIX_SIZE * MATRIX_SIZE; i++) {
		pixels[i] = null
	}
}

/**
 * Build a 32x32 ImageData from the current pixel state.
 * Applies time-based fading: pixels fade to black as they approach the timeout,
 * and are cleared once they exceed it.
 * @returns {ImageData} 32x32 RGBA image data ready for serial transmission
 */
export function getImageData() {
	const imageData = new ImageData(MATRIX_SIZE, MATRIX_SIZE)
	const data = imageData.data
	const now = performance.now()
	const timeoutMs = fadeTimeout * 1000

	for (let i = 0; i < pixels.length; i++) {
		const px = pixels[i]
		const offset = i * 4

		if (!px) {
			// Empty pixel → black
			data[offset + 0] = 0
			data[offset + 1] = 0
			data[offset + 2] = 0
			data[offset + 3] = 255
			continue
		}

		const age = now - px.t

		if (age >= timeoutMs) {
			// Pixel has expired — clear it
			pixels[i] = null
			data[offset + 0] = 0
			data[offset + 1] = 0
			data[offset + 2] = 0
			data[offset + 3] = 255
			continue
		}

		// Fade: full brightness at age 0, fades to black at timeout
		const fade = 1 - age / timeoutMs
		data[offset + 0] = Math.round(px.r * fade)
		data[offset + 1] = Math.round(px.g * fade)
		data[offset + 2] = Math.round(px.b * fade)
		data[offset + 3] = 255
	}

	return imageData
}

/**
 * Render the current state onto a canvas context for local preview.
 * @param {CanvasRenderingContext2D} ctx - A 32x32 canvas context
 */
export function renderPreview(ctx) {
	ctx.putImageData(getImageData(), 0, 0)
}
