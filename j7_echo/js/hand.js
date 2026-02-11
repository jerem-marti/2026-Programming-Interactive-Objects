/**
 * Hand tracking module — MediaPipe Hands with gesture feature extraction.
 *
 * Extends basic hand detection with rich gesture signals for the ritual:
 *   - hand_present (bool)
 *   - hand_center (x, y normalized 0..1)
 *   - hand_speed (0..1)
 *   - openness (0..1) — how open the hand is
 *   - pinch (0..1) — inverse of thumb-index distance
 *
 * Detection is pull-based — call detect() from your own RAF loop.
 */

const MATRIX_SIZE = 32

let videoStream = null
let videoElement = null
let handLandmarker = null
let running = false
let lastTimestamp = -1

// ─── Smoothed gesture features ───────────────────────────────────────────────

const SMOOTH = 0.3 // EMA smoothing factor (smaller = smoother)

let smoothCenter = { x: 0.5, y: 0.5 }
let smoothSpeed = 0
let smoothOpenness = 0
let smoothPinch = 0
let prevCenter = null
let prevTime = 0

/**
 * Load the MediaPipe HandLandmarker model.
 * Must be called before start().
 */
export async function init() {
	const { HandLandmarker, FilesetResolver } = await import(
		'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.21'
	)

	const vision = await FilesetResolver.forVisionTasks(
		'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.21/wasm'
	)

	handLandmarker = await HandLandmarker.createFromOptions(vision, {
		baseOptions: {
			modelAssetPath:
				'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/latest/hand_landmarker.task',
			delegate: 'GPU'
		},
		runningMode: 'VIDEO',
		numHands: 1,
		minHandDetectionConfidence: 0.5,
		minHandPresenceConfidence: 0.5,
		minTrackingConfidence: 0.5
	})
}

/**
 * Start the webcam. Detection is driven by calling detect().
 * @param {HTMLVideoElement} video - The video element to attach the stream to
 */
export async function start(video) {
	if (!handLandmarker) {
		throw new Error('HandLandmarker not initialized. Call init() first.')
	}

	videoElement = video

	const constraints = {
		video: {
			facingMode: 'user',
			width: { ideal: 640 },
			height: { ideal: 480 }
		}
	}

	videoStream = await navigator.mediaDevices.getUserMedia(constraints)
	video.srcObject = videoStream
	await video.play()

	running = true
	prevCenter = null
	prevTime = performance.now()
}

/**
 * Stop hand detection and release the camera.
 */
export function stop() {
	running = false

	if (videoStream) {
		videoStream.getTracks().forEach(track => track.stop())
		videoStream = null
	}
	if (videoElement) {
		videoElement.srcObject = null
		videoElement = null
	}

	prevCenter = null
}

/**
 * Check if hand tracking is currently running.
 * @returns {boolean}
 */
export function isRunning() {
	return running
}

/**
 * Run one detection on the current video frame.
 * Returns rich gesture features (smoothed).
 * @returns {GestureFeatures|null}
 *
 * @typedef {object} GestureFeatures
 * @property {boolean} handPresent
 * @property {{ x: number, y: number }} handCenter - Normalized 0..1 (mirrored)
 * @property {number} handSpeed - 0..1
 * @property {number} openness - 0..1 (1 = fully open)
 * @property {number} pinch - 0..1 (1 = fully pinched)
 * @property {object} landmarks - Raw landmarks array
 */
export function detect() {
	if (!running || !handLandmarker || !videoElement || videoElement.readyState < 2) {
		return null
	}

	let results
	try {
		let now = performance.now()
		if (now <= lastTimestamp) now = lastTimestamp + 1
		lastTimestamp = now

		results = handLandmarker.detectForVideo(videoElement, now)
	} catch (err) {
		console.error('Hand detection error:', err)
		return null
	}

	if (!results || !results.landmarks || results.landmarks.length === 0) {
		// Decay smoothed values when hand is lost
		smoothSpeed *= 0.9
		smoothPinch *= 0.9
		smoothOpenness = smoothOpenness * 0.95 + 0.5 * 0.05
		return {
			handPresent: false,
			handCenter: { ...smoothCenter },
			handSpeed: smoothSpeed,
			openness: smoothOpenness,
			pinch: smoothPinch,
			landmarks: null
		}
	}

	const landmarks = results.landmarks[0]
	const now = performance.now()

	// ── Hand center (palm base = wrist #0, middle of palm) ───────────────────
	const wrist = landmarks[0]
	const middleMcp = landmarks[9]
	const cx = 1 - (wrist.x + middleMcp.x) / 2 // Mirror for selfie
	const cy = (wrist.y + middleMcp.y) / 2

	smoothCenter.x += (cx - smoothCenter.x) * SMOOTH
	smoothCenter.y += (cy - smoothCenter.y) * SMOOTH

	// ── Hand speed ───────────────────────────────────────────────────────────
	if (prevCenter) {
		const dt = Math.max(now - prevTime, 1) / 1000 // seconds
		const dx = cx - prevCenter.x
		const dy = cy - prevCenter.y
		const rawSpeed = Math.sqrt(dx * dx + dy * dy) / dt
		// Normalize: ~2.0 units/sec = full speed
		const normSpeed = Math.min(rawSpeed / 2.0, 1.0)
		smoothSpeed += (normSpeed - smoothSpeed) * SMOOTH
	}
	prevCenter = { x: cx, y: cy }
	prevTime = now

	// ── Openness (average finger extension) ──────────────────────────────────
	// Compare fingertip-to-wrist distance vs MCP-to-wrist distance
	const fingerTips = [4, 8, 12, 16, 20] // thumb, index, middle, ring, pinky tips
	const fingerMcps = [2, 5, 9, 13, 17]  // corresponding base joints
	let totalOpen = 0
	for (let i = 0; i < 5; i++) {
		const tip = landmarks[fingerTips[i]]
		const mcp = landmarks[fingerMcps[i]]
		const tipDist = dist3d(tip, wrist)
		const mcpDist = dist3d(mcp, wrist)
		totalOpen += mcpDist > 0.001 ? Math.min(tipDist / mcpDist, 2.0) / 2.0 : 0.5
	}
	const rawOpenness = totalOpen / 5
	smoothOpenness += (rawOpenness - smoothOpenness) * SMOOTH

	// ── Pinch (thumb-index proximity) ────────────────────────────────────────
	const thumb = landmarks[4]
	const index = landmarks[8]
	const pinchDist = dist3d(thumb, index)
	// Map: 0.03 → fully pinched (1.0), 0.12 → not pinched (0.0)
	const rawPinch = 1.0 - Math.min(Math.max((pinchDist - 0.03) / 0.09, 0), 1)
	smoothPinch += (rawPinch - smoothPinch) * SMOOTH

	return {
		handPresent: true,
		handCenter: { ...smoothCenter },
		handSpeed: smoothSpeed,
		openness: smoothOpenness,
		pinch: smoothPinch,
		landmarks
	}
}

/**
 * 3D Euclidean distance between two landmarks.
 */
function dist3d(a, b) {
	const dx = a.x - b.x
	const dy = a.y - b.y
	const dz = (a.z || 0) - (b.z || 0)
	return Math.sqrt(dx * dx + dy * dy + dz * dz)
}
