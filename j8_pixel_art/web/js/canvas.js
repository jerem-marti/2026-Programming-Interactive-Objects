/**
 * Canvas management module.
 *
 * Creates and manages the 32×32 pixel canvas used for rendering
 * pixel art before sending it to the LED matrix.
 */

const CANVAS_SCALE = 12 // CSS upscale factor for display

/**
 * Initialise a canvas and return its 2D context.
 *
 * @param {HTMLCanvasElement} canvas — the <canvas> element
 * @param {number} width  — logical width  (default 32)
 * @param {number} height — logical height (default 32)
 * @returns {CanvasRenderingContext2D}
 */
export function initCanvas(canvas, width = 32, height = 32) {
	canvas.width = width
	canvas.height = height
	canvas.style.width = width * CANVAS_SCALE + 'px'
	canvas.style.height = height * CANVAS_SCALE + 'px'
	return canvas.getContext('2d', { willReadFrequently: true })
}

/**
 * Clear the canvas to black.
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} w
 * @param {number} h
 */
export function clear(ctx, w = 32, h = 32) {
	ctx.fillStyle = '#000'
	ctx.fillRect(0, 0, w, h)
}

/**
 * Get the full ImageData of the canvas.
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} w
 * @param {number} h
 * @returns {ImageData}
 */
export function getImageData(ctx, w = 32, h = 32) {
	return ctx.getImageData(0, 0, w, h)
}
