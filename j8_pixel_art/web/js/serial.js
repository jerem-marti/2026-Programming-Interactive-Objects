/**
 * Serial communication module (Web Serial API).
 *
 * Handles connecting to the serial port and sending pixel frames
 * using the RGB565 protocol expected by the LED matrix firmware.
 *
 * Protocol:
 *   Byte 0      : '*' (0x2A) — start-of-frame marker
 *   Bytes 1–2048: 16-bit RGB565 pixel data, big-endian, row-major
 */

const BAUD_RATE = 921600

/** @type {WritableStreamDefaultWriter|null} */
let writer = null

/**
 * Request and open a serial port via the Web Serial API.
 * @returns {Promise<boolean>} true on success
 */
export async function connect() {
	try {
		const port = await navigator.serial.requestPort()
		await port.open({ baudRate: BAUD_RATE })
		writer = port.writable.getWriter()
		return true
	} catch (err) {
		console.error('Serial connect error:', err)
		writer = null
		return false
	}
}

/**
 * @returns {boolean} whether a serial connection is active
 */
export function isConnected() {
	return writer !== null
}

/**
 * Send a full frame of pixel data extracted from the canvas.
 * Converts RGBA → RGB565 and prepends the start marker.
 *
 * @param {ImageData} imageData — canvas pixel data (RGBA)
 * @param {Uint8Array} buffer   — pre-allocated send buffer (1 + W*H*2 bytes)
 */
export async function sendFrame(imageData, buffer) {
	if (!writer) return

	const pixels = imageData.data
	buffer[0] = 42 // '*'
	let idx = 1

	for (let i = 0; i < pixels.length; i += 4) {
		const r = pixels[i]
		const g = pixels[i + 1]
		const b = pixels[i + 2]
		const rgb16 = packRGB565(r, g, b)
		buffer[idx++] = (rgb16 >> 8) & 0xff // high byte
		buffer[idx++] = rgb16 & 0xff         // low byte
	}

	try {
		await writer.write(buffer)
	} catch (err) {
		console.error('Serial write error:', err)
		writer = null
	}
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Pack 8-bit RGB into 16-bit RGB565.
 * Layout: RRRRRGGG GGGBBBBB
 */
function packRGB565(r, g, b) {
	return ((r >> 3) << 11) | ((g >> 2) << 5) | (b >> 3)
}
