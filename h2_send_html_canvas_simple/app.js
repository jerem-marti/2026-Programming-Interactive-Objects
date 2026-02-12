import { serialPortWriterLoop } from './serial_port_writer.js'

const TOTAL_WIDTH = 32
const TOTAL_HEIGHT = 32
const TARGET_FPS = 30 // frames per second

const canvas = document.querySelector('canvas')
const ctx = canvas.getContext('2d', { willReadFrequently: true })
canvas.width = TOTAL_WIDTH
canvas.height = TOTAL_HEIGHT
canvas.style.width = TOTAL_WIDTH * 10 + 'px'
canvas.style.height = TOTAL_HEIGHT * 10 + 'px'

// Some timing variables
let frame = 0      // Frame counter
let timeSample = 0 // Time sample to calculate precise offset

requestAnimationFrame(loop)




// Start the animation loop
requestAnimationFrame(loop)

function loop(time) {

	requestAnimationFrame(loop)

	// Throttle the refresh rate to TARGET_FPS so to not
	// flood the serial port with data
	const delta = time - timeSample
	const interval = 1000 / TARGET_FPS
	if (delta < interval) {
		return
	}
	timeSample = time - delta % interval

	// ----------------------------------------------------
	// Draw something on the canvas

	ctx.fillStyle = 'black'
	ctx.fillRect(0, 0, canvas.width, canvas.height)

	ctx.fillStyle = 'white'
	ctx.save()
	ctx.translate(TOTAL_WIDTH / 2, TOTAL_HEIGHT / 2)
	ctx.rotate(frame * 0.03)
	ctx.fillRect(-12, -4, 24, 8)
	ctx.fillRect(-4, -12, 8, 24)
	ctx.fill()
	ctx.restore()

	frame++





	// ----------------------------------------------------
	serialPortWriterLoop(ctx)
}

