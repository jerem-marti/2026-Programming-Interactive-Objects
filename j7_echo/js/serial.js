/**
 * Serial communication module for the 32x32 RGB LED matrix.
 *
 * Handles Web Serial API connection and pixel data transmission.
 * Protocol: sends '*' (0x2A) followed by RGB565 pixel data.
 */

const BAUD_RATE = 921600
const TOTAL_WIDTH = 32
const TOTAL_HEIGHT = 32
const COLOR_DEPTH = 16 // 16-bit RGB565

// Pre-allocate the pixel data buffer: 1 byte header + pixel data
const PIXEL_DATA = new Uint8Array(1 + TOTAL_WIDTH * TOTAL_HEIGHT * (COLOR_DEPTH / 8))
PIXEL_DATA[0] = 42 // '*' magic byte

let writer = null
let serialPort = null

/**
 * Request and open a serial port connection.
 * @returns {Promise<boolean>} true if connected successfully
 */
export async function connect() {
	try {
		serialPort = await navigator.serial.requestPort()
		await serialPort.open({ baudRate: BAUD_RATE })
		writer = serialPort.writable.getWriter()
		return true
	} catch (err) {
		console.error('Serial connection error:', err)
		writer = null
		serialPort = null
		return false
	}
}

/**
 * Disconnect from the serial port.
 */
export async function disconnect() {
	try {
		if (writer) {
			writer.releaseLock()
			writer = null
		}
		if (serialPort) {
			await serialPort.close()
			serialPort = null
		}
	} catch (err) {
		console.error('Serial disconnect error:', err)
	}
}

/**
 * Check if the serial port is connected and ready.
 * @returns {boolean}
 */
export function isConnected() {
	return writer !== null
}

/**
 * Send an ImageData (32x32 RGBA) to the matrix via serial.
 * Converts to RGB565 before sending.
 * @param {ImageData} imageData - 32x32 RGBA image data
 */
export async function sendImageData(imageData) {
	if (!writer) return

	const pixels = imageData.data
	let idx = 1 // Start after the magic byte

	for (let i = 0; i < pixels.length; i += 4) {
		const r = pixels[i + 0]
		const g = pixels[i + 1]
		const b = pixels[i + 2]
		const rgb16 = packRGB16(r, g, b)
		PIXEL_DATA[idx++] = (rgb16 >> 8) & 0xFF // high byte
		PIXEL_DATA[idx++] = rgb16 & 0xFF         // low byte
	}

	try {
		await writer.write(PIXEL_DATA)
	} catch (err) {
		// Don't null writer on transient errors — just skip this frame
		console.warn('Serial write skipped:', err.message)
	}
}

/**
 * Convert 8-bit RGB to 16-bit RGB565.
 * Pack into: RRRRRGGG GGGBBBBB
 */
function packRGB16(r, g, b) {
	const r5 = (r >> 3) & 0x1F
	const g6 = (g >> 2) & 0x3F
	const b5 = (b >> 3) & 0x1F
	return (r5 << 11) | (g6 << 5) | b5
}
