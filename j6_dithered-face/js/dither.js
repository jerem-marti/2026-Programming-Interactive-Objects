/**
 * Floyd-Steinberg error diffusion dithering module.
 *
 * Reduces an image to the RGB565 color palette (5-6-5 bits/channel)
 * while distributing quantization error to neighboring pixels.
 *
 * Error distribution pattern:
 *         pixel   7/16
 *  3/16   5/16    1/16
 *
 * Reused from j4_dithered-portrait.
 */

/**
 * Apply Floyd-Steinberg dithering to an ImageData object (in-place).
 *
 * @param {ImageData} imageData — RGBA source
 * @param {object}    opts
 * @param {boolean}   opts.grayscale — convert to grayscale first
 * @param {number}    opts.strength  — error diffusion strength 0–1
 * @returns {ImageData} the same reference, modified in-place
 */
export function floydSteinberg(imageData, opts = {}) {
	const { grayscale = false, strength = 1.0 } = opts
	const w    = imageData.width
	const h    = imageData.height
	const data = imageData.data

	const r = new Float32Array(w * h)
	const g = new Float32Array(w * h)
	const b = new Float32Array(w * h)

	for (let i = 0; i < w * h; i++) {
		const p = i * 4
		if (grayscale) {
			const lum = 0.2126 * data[p] + 0.7152 * data[p + 1] + 0.0722 * data[p + 2]
			r[i] = g[i] = b[i] = lum
		} else {
			r[i] = data[p]
			g[i] = data[p + 1]
			b[i] = data[p + 2]
		}
	}

	for (let y = 0; y < h; y++) {
		for (let x = 0; x < w; x++) {
			const i = y * w + x

			const oR = r[i], oG = g[i], oB = b[i]
			const nR = q5(oR), nG = q6(oG), nB = q5(oB)
			r[i] = nR; g[i] = nG; b[i] = nB

			const eR = (oR - nR) * strength
			const eG = (oG - nG) * strength
			const eB = (oB - nB) * strength

			if (x + 1 < w) { const j = i + 1;           r[j] += eR * 7/16; g[j] += eG * 7/16; b[j] += eB * 7/16 }
			if (y + 1 < h) {
				if (x - 1 >= 0) { const j = (y+1)*w+x-1; r[j] += eR * 3/16; g[j] += eG * 3/16; b[j] += eB * 3/16 }
				                  { const j = (y+1)*w+x;   r[j] += eR * 5/16; g[j] += eG * 5/16; b[j] += eB * 5/16 }
				if (x + 1 < w) { const j = (y+1)*w+x+1; r[j] += eR * 1/16; g[j] += eG * 1/16; b[j] += eB * 1/16 }
			}
		}
	}

	for (let i = 0; i < w * h; i++) {
		const p = i * 4
		data[p]     = clamp(r[i])
		data[p + 1] = clamp(g[i])
		data[p + 2] = clamp(b[i])
	}
	return imageData
}

function q5(v) { return Math.round(v / 255 * 31) * 255 / 31 }
function q6(v) { return Math.round(v / 255 * 63) * 255 / 63 }
function clamp(v) { return Math.max(0, Math.min(255, Math.round(v))) }
