/**
 * Camera module — webcam capture and image loading.
 *
 * Provides methods to start/stop the webcam, capture a single frame,
 * and load external images. All outputs are scaled to 32x32 pixels.
 */

const MATRIX_SIZE = 32

let videoStream = null
let videoElement = null

/**
 * Start the webcam and return the video element.
 * Requests the user-facing camera by default (selfie / portrait).
 * @param {HTMLVideoElement} video - The video element to attach the stream to
 * @returns {Promise<HTMLVideoElement>}
 */
export async function startCamera(video) {
	const constraints = {
		video: {
			facingMode: 'user',
			width: { ideal: 640 },
			height: { ideal: 640 }
		}
	}

	try {
		videoStream = await navigator.mediaDevices.getUserMedia(constraints)
		video.srcObject = videoStream
		videoElement = video
		await video.play()
		return video
	} catch (err) {
		console.error('Camera error:', err)
		throw err
	}
}

/**
 * Stop the webcam stream.
 */
export function stopCamera() {
	if (videoStream) {
		videoStream.getTracks().forEach(track => track.stop())
		videoStream = null
	}
	if (videoElement) {
		videoElement.srcObject = null
		videoElement = null
	}
}

/**
 * Check if the camera is currently active.
 * @returns {boolean}
 */
export function isCameraActive() {
	return videoStream !== null
}

/**
 * Capture the current video frame and return it as 32x32 ImageData.
 * Crops the center square region before scaling down.
 * @param {HTMLVideoElement} video - The video element to capture from
 * @param {CanvasRenderingContext2D} ctx - A 32x32 canvas context to draw to
 * @returns {ImageData} 32x32 RGBA pixel data
 */
export function captureFrame(video, ctx) {
	const vw = video.videoWidth
	const vh = video.videoHeight

	// Crop center square
	const size = Math.min(vw, vh)
	const sx = (vw - size) / 2
	const sy = (vh - size) / 2

	ctx.drawImage(video, sx, sy, size, size, 0, 0, MATRIX_SIZE, MATRIX_SIZE)
	return ctx.getImageData(0, 0, MATRIX_SIZE, MATRIX_SIZE)
}

/**
 * Load an image file (from File input) and return it as 32x32 ImageData.
 * @param {File} file - The image file to load
 * @param {CanvasRenderingContext2D} ctx - A 32x32 canvas context to draw to
 * @returns {Promise<ImageData>} 32x32 RGBA pixel data
 */
export function loadImageFile(file, ctx) {
	return new Promise((resolve, reject) => {
		const img = new Image()
		const url = URL.createObjectURL(file)

		img.onload = () => {
			// Crop center square from the source image
			const size = Math.min(img.width, img.height)
			const sx = (img.width - size) / 2
			const sy = (img.height - size) / 2

			ctx.clearRect(0, 0, MATRIX_SIZE, MATRIX_SIZE)
			ctx.drawImage(img, sx, sy, size, size, 0, 0, MATRIX_SIZE, MATRIX_SIZE)
			URL.revokeObjectURL(url)
			resolve(ctx.getImageData(0, 0, MATRIX_SIZE, MATRIX_SIZE))
		}

		img.onerror = () => {
			URL.revokeObjectURL(url)
			reject(new Error('Failed to load image'))
		}

		img.src = url
	})
}
