/**
 * Serial communication module for the 32×32 RGB LED matrix.
 *
 * Handles Web Serial API connection and pixel data transmission.
 * Protocol: sends '*' (0x2A) header followed by RGB565 pixel data.
 *
 * Reused from j4_dithered-portrait.
 */

const BAUD_RATE     = 921600
const TOTAL_WIDTH   = 32
const TOTAL_HEIGHT  = 32
const COLOR_DEPTH   = 16 // 16-bit RGB565

// Pre-allocate buffer: 1 header byte + pixel data
const PIXEL_DATA = new Uint8Array(1 + TOTAL_WIDTH * TOTAL_HEIGHT * (COLOR_DEPTH / 8))
PIXEL_DATA[0] = 42 // '*' magic byte

let writer     = null
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
		if (writer) { writer.releaseLock(); writer = null }
		if (serialPort) { await serialPort.close(); serialPort = null }
	} catch (err) {
		console.error('Serial disconnect error:', err)
	}
}

/**
 * @returns {boolean} true if serial is connected and ready
 */
export function isConnected() {
	return writer !== null
}

/**
 * Send a 32×32 RGBA ImageData to the matrix via serial (RGB565).
 * @param {ImageData} imageData — 32×32 RGBA
 */
export async function sendImageData(imageData) {
	if (!writer) return

	const px = imageData.data
	let idx = 1 // skip header byte

	for (let i = 0; i < px.length; i += 4) {
		const rgb16 = packRGB16(px[i], px[i + 1], px[i + 2])
		PIXEL_DATA[idx++] = (rgb16 >> 8) & 0xFF
		PIXEL_DATA[idx++] =  rgb16       & 0xFF
	}

	try {
		await writer.write(PIXEL_DATA)
	} catch (err) {
		console.error('Serial write error:', err)
		writer = null
	}
}

/** Convert 8-bit RGB → 16-bit RGB565 */
function packRGB16(r, g, b) {
	return ((r >> 3) << 11) | ((g >> 2) << 5) | (b >> 3)
}
