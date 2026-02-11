/**
 * Floyd-Steinberg error diffusion dithering module.
 *
 * Supports two quantization targets:
 *   - RGB565 (5-6-5 bits/channel) — thousands of colors
 *   - 1-bit monochrome — pure black & white
 *
 * The 1-bit mode produces the classic dithered portrait aesthetic
 * (like newspaper halftones or retro Mac graphics).
 *
 * Error distribution pattern:
 *         pixel   7/16
 *  3/16   5/16    1/16
 */

/**
 * Apply Floyd-Steinberg dithering to an ImageData object (in-place).
 *
 * @param {ImageData} imageData — RGBA source
 * @param {object}    opts
 * @param {boolean}   opts.monochrome  — true = 1-bit black/white (default true)
 * @param {boolean}   opts.grayscale   — convert to grayscale (forced true when monochrome)
 * @param {number}    opts.strength    — error diffusion strength 0–1 (default 1.0)
 * @param {number}    opts.brightness  — brightness offset -100…+100 (default 0)
 * @param {number}    opts.contrast    — contrast multiplier 0.5…3.0 (default 1.0)
 * @param {number}    opts.threshold   — 1-bit threshold 0–255 (default 128)
 * @param {string}    opts.fgColor     — foreground hex color for monochrome (default '#ffffff')
 * @param {string}    opts.bgColor     — background hex color for monochrome (default '#000000')
 * @returns {ImageData} the same reference, modified in-place
 */
export function floydSteinberg(imageData, opts = {}) {
	const {
		monochrome = true,
		grayscale  = false,
		strength   = 1.0,
		brightness = 0,
		contrast   = 1.0,
		threshold  = 128,
		fgColor    = '#ffffff',
		bgColor    = '#000000'
	} = opts

	const w    = imageData.width
	const h    = imageData.height
	const data = imageData.data
	const useGray = monochrome || grayscale

	// Parse fg/bg colors for monochrome output
	const fg = parseHex(fgColor)
	const bg = parseHex(bgColor)

	// Build float arrays with brightness/contrast pre-processing
	const lum = new Float32Array(w * h)  // for monochrome
	const r = new Float32Array(w * h)
	const g = new Float32Array(w * h)
	const b = new Float32Array(w * h)

	for (let i = 0; i < w * h; i++) {
		const p = i * 4
		let cr = data[p], cg = data[p + 1], cb = data[p + 2]

		// Apply brightness
		cr += brightness; cg += brightness; cb += brightness

		// Apply contrast (around midpoint 128)
		cr = (cr - 128) * contrast + 128
		cg = (cg - 128) * contrast + 128
		cb = (cb - 128) * contrast + 128

		if (useGray) {
			const l = 0.2126 * cr + 0.7152 * cg + 0.0722 * cb
			lum[i] = l
			r[i] = g[i] = b[i] = l
		} else {
			r[i] = cr; g[i] = cg; b[i] = cb
		}
	}

	if (monochrome) {
		// ── 1-bit Floyd-Steinberg ────────────────────────────────────────
		for (let y = 0; y < h; y++) {
			for (let x = 0; x < w; x++) {
				const i = y * w + x
				const old = lum[i]
				const val = old >= threshold ? 255 : 0
				lum[i] = val

				const err = (old - val) * strength

				if (x + 1 < w)                 lum[i + 1]           += err * 7 / 16
				if (y + 1 < h) {
					if (x - 1 >= 0)             lum[(y+1)*w + x - 1] += err * 3 / 16
					                            lum[(y+1)*w + x]     += err * 5 / 16
					if (x + 1 < w)              lum[(y+1)*w + x + 1] += err * 1 / 16
				}
			}
		}

		// Write 1-bit result with fg/bg colors
		for (let i = 0; i < w * h; i++) {
			const p = i * 4
			const c = lum[i] >= 128 ? fg : bg
			data[p]     = c[0]
			data[p + 1] = c[1]
			data[p + 2] = c[2]
		}
	} else {
		// ── RGB565 Floyd-Steinberg ───────────────────────────────────────
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
	}

	return imageData
}

function q5(v) { return Math.round(v / 255 * 31) * 255 / 31 }
function q6(v) { return Math.round(v / 255 * 63) * 255 / 63 }
function clamp(v) { return Math.max(0, Math.min(255, Math.round(v))) }

/** Parse '#rrggbb' → [r, g, b] */
function parseHex(hex) {
	const n = parseInt(hex.slice(1), 16)
	return [(n >> 16) & 0xFF, (n >> 8) & 0xFF, n & 0xFF]
}
