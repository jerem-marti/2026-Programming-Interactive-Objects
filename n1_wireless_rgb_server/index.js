const dgram = require('dgram');

const server = dgram.createSocket('udp4');

const UDP_PORT = 44444;
const CLIENT_ADDRESS = '192.168.1.103';

const COLOR_DEPTH = 16;
const CHUNK_SIZE = 1024; // Safe UDP packet size

const TOTAL_WIDTH = 32;
const TOTAL_HEIGHT = 32;

const INTERVAL = 1000 / 120; // 60 FPS

// Create a buffer of 32x32 pixels with 16-bit color (2 bytes per pixel)
const pixels = new Uint8Array(TOTAL_WIDTH * TOTAL_HEIGHT * (COLOR_DEPTH / 8));

server.bind(UDP_PORT);

// Function to send pixels in chunks
function sendPixels(pixels, clientAddress = CLIENT_ADDRESS, clientPort = UDP_PORT, chunkSize = CHUNK_SIZE) {

    const totalChunks = Math.ceil(pixels.length / chunkSize);

    for (let i = 0; i < totalChunks; i++) {
        const start = i * chunkSize;
        const end = Math.min(start + chunkSize, pixels.length);
        const chunk = pixels.slice(start, end);

        // Prepend chunk index and total chunks to the data
        const chunkHeader = new Uint8Array([i, totalChunks]);
        const chunkWithHeader = new Uint8Array(chunkHeader.length + chunk.length);
        chunkWithHeader.set(chunkHeader);
        chunkWithHeader.set(chunk, chunkHeader.length);

        server.send(chunkWithHeader, clientPort, clientAddress, (err) => {
            if (err) {
                console.log(`Error sending chunk ${i}:`, err);
            } else {
                console.log(`Chunk ${i + 1}/${totalChunks} sent to ${clientAddress}:${clientPort}`);
            }
        });
    }
}

let frame = 0;

setInterval(() => {

	// Gradient
	if (frame % pixels.length == 0) {
		for (let i = 0; i < TOTAL_WIDTH * TOTAL_HEIGHT; i++) {
			const r = (i % TOTAL_WIDTH) * 8;
			const g = Math.floor(i / TOTAL_WIDTH) * 8;
			const b = 128;

			if (COLOR_DEPTH === 16) {
				const rgb565 = ((r & 0xF8) << 8) |
							   ((g & 0xFC) << 3) |
							   (b >> 3);

				pixels[i * 2] = (rgb565 >> 8) & 0xFF;
				pixels[i * 2 + 1] = rgb565 & 0xFF;
			} else if (COLOR_DEPTH === 24) {
				pixels[i * 3] = r;
				pixels[i * 3 + 1] = g;
				pixels[i * 3 + 2] = b;
			}
		}
	}

	function length(v) {
		return Math.sqrt(v.x * v.x + v.y * v.y);
	}
	function rot(v, a) {
		const r = {
			x: v.x * Math.cos(a) - v.y * Math.sin(a),
			y: v.x * Math.sin(a) + v.y * Math.cos(a)
		}
		v.x = r.x
		v.y = r.y
	}

	const colors = [{
		r: 200,
		g: 0,
		b: 0
	}, {
		r: 0,
		g: 200,
		b: 0
	}, {
		r: 0,
		g: 0,
		b: 200
	}, {
		r: 200,
		g: 200,
		b: 0
	}, {
		r: 200,
		g: 0,
		b: 200
	}]

	let idx = 0
	const t = frame * 0.01
	for (let j = 0; j<TOTAL_HEIGHT; j++) {
		for (let i = 0; i<TOTAL_WIDTH; i++) {
			const u = i / (TOTAL_WIDTH - 2) * 2 - 1;
			const v = j / (TOTAL_HEIGHT - 2) * 2 - 1;

			let st = {x: u, y: v}

			for (let k=0; k<5; k++) {
				const o = k * 3
				st.x += Math.sin(t * 3 + o)
				st.y += Math.cos(t * 2 + o)

				const ang = -t + length({x: st.x - 0.5, y: st.y - 0.5})
				rot(st, ang)
			}

			st.x *= 0.08
			st.y *= 0.08

			const s = Math.cos(t) * 2.0
			let c = Math.sin(st.x * 3.0 + s) + Math.sin(st.y * 21)
			c = map(Math.sin(c * 0.5), -1, 1, 0, 1)


			const color = colors[Math.floor(c * (colors.length - 1))]





			// const d = Math.sqrt(u * u + v * v);
			// const gray = (Math.sin(d * 7.0 - frame * 0.3) * 0.5 + 0.5) * 255.0;
			// const rgb16 = rgb565(gray, gray, gray);
			const rgb16 = rgb565(color.r, color.g, color.b)
			const bytes = getBytesFrom16Bit(rgb16);

			pixels[idx++] = bytes[0];
			pixels[idx++] = bytes[1];
		}
	}
	frame++

    sendPixels(pixels);

}, INTERVAL);


// -- HELPERS ---------------------------------------------------------------

/**
 * Maps a value from one range to another range
 * @param value The value to map
 * @param in_min The lower bound of the input range
 * @param in_max The upper bound of the input range
 * @param out_min The lower bound of the output range
 * @param out_max The upper bound of the output range
 * @returns {number} The mapped value in the output range
 */
function map(value, in_min, in_max, out_min, out_max) {
	return (value - in_min) * (out_max - out_min) / (in_max - in_min) + out_min;
}

/**
 * Converts RGB color values to RGB565 format
 * @param r Red value (0-255)
 * @param g Green value (0-255)
 * @param b Blue value (0-255)
 * @returns {number} 16-bit RGB565 color value
 */
function rgb565(r, g, b) {
	return ((r & 0xF8) << 8) |
		   ((g & 0xFC) << 3) |
		   (b >> 3);
}

function getBytesFrom16Bit(value) {
	return [
		(value >> 8) & 0xFF,
		value & 0xFF
	];
}
