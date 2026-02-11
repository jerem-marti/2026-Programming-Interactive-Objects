/**
 * Camera module — webcam capture.
 *
 * Provides methods to start/stop the webcam and capture frames.
 * Adapted from j4_dithered-portrait, but here we keep the full
 * resolution for MediaPipe processing; cropping/scaling is handled
 * by faceRenderer.
 */

let videoStream = null
let videoElement = null

/**
 * Start the webcam and attach the stream to a <video> element.
 * Requests user-facing camera (selfie mode).
 * @param {HTMLVideoElement} video
 * @returns {Promise<HTMLVideoElement>}
 */
export async function startCamera(video) {
	const constraints = {
		video: {
			facingMode: 'user',
			width:  { ideal: 640 },
			height: { ideal: 480 }
		}
	}

	videoStream = await navigator.mediaDevices.getUserMedia(constraints)
	video.srcObject = videoStream
	videoElement = video
	await video.play()
	return video
}

/**
 * Stop the webcam stream and release resources.
 */
export function stopCamera() {
	if (videoStream) {
		videoStream.getTracks().forEach(t => t.stop())
		videoStream = null
	}
	if (videoElement) {
		videoElement.srcObject = null
		videoElement = null
	}
}

/**
 * @returns {boolean} true if camera is currently streaming
 */
export function isCameraActive() {
	return videoStream !== null
}

/**
 * Get the raw HTMLVideoElement (for MediaPipe input).
 * @returns {HTMLVideoElement | null}
 */
export function getVideoElement() {
	return videoElement
}
