/**
 * Floyd-Steinberg error diffusion dithering module.
 *
 * Reduces an image to the RGB565 color palette (5-6-5 bits per channel)
 * while distributing quantization error to neighboring pixels,
 * producing visually superior results on low-resolution displays.
 *
 * Error distribution pattern:
 *         pixel   7/16
 *  3/16   5/16    1/16
 */

/**
 * Apply Floyd-Steinberg dithering to an ImageData object.
 * Modifies the pixel data in-place and returns it.
 *
 * @param {ImageData} imageData - Source image (RGBA)
 * @param {object}    options   - Optional settings
 * @param {boolean}   options.grayscale - Convert to grayscale before dithering
 * @param {number}    options.strength  - Error diffusion strength 0.0–1.0 (default 1.0)
 * @returns {ImageData} The dithered image data (same reference, modified in-place)
 */
export function floydSteinberg(imageData, options = {}) {
	const { grayscale = false, strength = 1.0 } = options

	const w = imageData.width
	const h = imageData.height
	const data = imageData.data

	// Work with floating-point copies to accumulate error precisely
	const r = new Float32Array(w * h)
	const g = new Float32Array(w * h)
	const b = new Float32Array(w * h)

	// Copy pixel data into float arrays
	for (let i = 0; i < w * h; i++) {
		const idx = i * 4
		if (grayscale) {
			// Luminance (Rec. 709)
			const lum = 0.2126 * data[idx] + 0.7152 * data[idx + 1] + 0.0722 * data[idx + 2]
			r[i] = lum
			g[i] = lum
			b[i] = lum
		} else {
			r[i] = data[idx]
			g[i] = data[idx + 1]
			b[i] = data[idx + 2]
		}
	}

	// Floyd-Steinberg error diffusion
	for (let y = 0; y < h; y++) {
		for (let x = 0; x < w; x++) {
			const i = y * w + x

			// Quantize to RGB565 levels
			const oldR = r[i]
			const oldG = g[i]
			const oldB = b[i]

			const newR = quantize5bit(oldR)
			const newG = quantize6bit(oldG)
			const newB = quantize5bit(oldB)

			r[i] = newR
			g[i] = newG
			b[i] = newB

			// Calculate quantization error
			const errR = (oldR - newR) * strength
			const errG = (oldG - newG) * strength
			const errB = (oldB - newB) * strength

			// Distribute error to neighbors
			//   current  7/16
			//   3/16     5/16   1/16
			if (x + 1 < w) {
				const j = i + 1
				r[j] += errR * 7 / 16
				g[j] += errG * 7 / 16
				b[j] += errB * 7 / 16
			}
			if (y + 1 < h) {
				if (x - 1 >= 0) {
					const j = (y + 1) * w + (x - 1)
					r[j] += errR * 3 / 16
					g[j] += errG * 3 / 16
					b[j] += errB * 3 / 16
				}
				{
					const j = (y + 1) * w + x
					r[j] += errR * 5 / 16
					g[j] += errG * 5 / 16
					b[j] += errB * 5 / 16
				}
				if (x + 1 < w) {
					const j = (y + 1) * w + (x + 1)
					r[j] += errR * 1 / 16
					g[j] += errG * 1 / 16
					b[j] += errB * 1 / 16
				}
			}
		}
	}

	// Write quantized values back to ImageData
	for (let i = 0; i < w * h; i++) {
		const idx = i * 4
		data[idx]     = clamp(r[i])
		data[idx + 1] = clamp(g[i])
		data[idx + 2] = clamp(b[i])
		// Keep alpha unchanged
	}

	return imageData
}

/**
 * Quantize an 8-bit value to 5-bit precision (32 levels).
 * Output is scaled back to 0–255 range.
 */
function quantize5bit(value) {
	const level = Math.round(value / 255 * 31)
	return (level * 255) / 31
}

/**
 * Quantize an 8-bit value to 6-bit precision (64 levels).
 * Output is scaled back to 0–255 range.
 */
function quantize6bit(value) {
	const level = Math.round(value / 255 * 63)
	return (level * 255) / 63
}

/**
 * Clamp a value to the 0–255 range.
 */
function clamp(value) {
	return Math.max(0, Math.min(255, Math.round(value)))
}
