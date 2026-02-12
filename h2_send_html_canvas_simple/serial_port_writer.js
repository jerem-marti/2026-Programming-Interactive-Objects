const TOTAL_WIDTH = 32
const TOTAL_HEIGHT = 32


const BAUD_RATE = 921600
const COLOR_DEPTH = 16 // 16 or 24 bits

const PIXEL_DATA = new Uint8Array(1 + TOTAL_WIDTH * TOTAL_HEIGHT * (COLOR_DEPTH / 8))


// Serial port writer
let writer = null

// Handle serial port connection
document.getElementById('connect').addEventListener('click', async () => {
	try {
		// Request serial port access
		const serialPort = await navigator.serial.requestPort()
		await serialPort.open({ baudRate: BAUD_RATE })
		writer = await serialPort.writable.getWriter()
	} catch (err) {
		const error = 'Error opening serial port: ' + err
		console.error(error)
		writer = null
	}
})

export async function serialPortWriterLoop(ctx) {

	// ----------------------------------------------------

	// Send the pixel data to the serial port (requires writer)
	if (!writer) return

	// Get pixel data from canvas
	const imageData = ctx.getImageData(0, 0, ctx.canvas.width, ctx.canvas.height);
	const pixels = imageData.data;

	try {
		// Send pixel data
		// The first byte is a magic number to identify the data format
		PIXEL_DATA[0] = 42
		let idx = 1 // Start at the second byte

		if (COLOR_DEPTH == 24) {
			for (let i = 0; i < pixels.length; i += 4) {
				const r = pixels[i + 0]
				const g = pixels[i + 1]
				const b = pixels[i + 2]
				PIXEL_DATA[idx++] = r
				PIXEL_DATA[idx++] = g
				PIXEL_DATA[idx++] = b
			}
		} else if (COLOR_DEPTH == 16) {
			for (let i = 0; i < pixels.length; i += 4) {
				const r = pixels[i + 0]
				const g = pixels[i + 1]
				const b = pixels[i + 2]
				const rgb16 = packRGB16(r, g, b)
				const [highByte, lowByte] = splitBytes(rgb16)
				PIXEL_DATA[idx++] = highByte
				PIXEL_DATA[idx++] = lowByte
			}
		}

		await writer.write(PIXEL_DATA)

	} catch (err) {
		const error = 'Error in draw loop: ' + err
		console.error(error)
		log.textContent = log.textContent + '\n' + error
		cancelAnimationFrame(rafID)

	} finally {
		// writer.releaseLock()
	}
}


// Convert 8-bit RGB values to 5-6-5 bits
// Pack into 16-bit value: RRRRRGGG GGGBBBBB
function packRGB16(r, g, b) {
	const r5 = (r >> 3) & 0x1F  // 5 bits for red
	const g6 = (g >> 2) & 0x3F  // 6 bits for green
	const b5 = (b >> 3) & 0x1F  // 5 bits for blue
	return (r5 << 11) | (g6 << 5) | b5
}

function splitBytes(int16) {
	const highByte = (int16 >> 8) & 0xFF  // Get upper 8 bits
	const lowByte = int16 & 0xFF          // Get lower 8 bits
	return [highByte, lowByte]
}

function unpackRGB16(rgb16) {
	const r5 = (rgb16 >> 11) & 0x1F
	const g6 = (rgb16 >> 5) & 0x3F
	const b5 = rgb16 & 0x1F
	return [r5 << 3, g6 << 2, b5 << 3]
}