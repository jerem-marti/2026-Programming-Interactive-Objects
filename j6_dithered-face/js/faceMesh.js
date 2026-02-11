/**
 * Face Mesh module — MediaPipe Face Mesh integration.
 *
 * Uses the MediaPipe FaceMesh (via the @mediapipe/tasks-vision CDN)
 * to detect 478 facial landmarks and extract expression metrics
 * that drive the pixel-art mimicry.
 *
 * Exported metrics (all 0–1 normalized):
 *   - leftEyeOpen, rightEyeOpen   : eye aperture
 *   - mouthOpen                    : vertical mouth opening
 *   - mouthWidth                   : horizontal mouth stretch
 *   - leftBrowRaise, rightBrowRaise: eyebrow lift
 *   - headYaw, headPitch, headRoll : head rotation (radians)
 *   - faceBox { x, y, w, h }      : bounding box in video coords
 *   - landmarks[]                  : raw 478 landmarks (x/y/z normalized)
 */

// ─── MediaPipe landmark indices (FaceMesh canonical) ────────────────────────
// Reference: https://github.com/google-ai-edge/mediapipe/blob/master/mediapipe/modules/face_geometry/data/canonical_face_model_uv_visualization.png

// Eye aperture landmarks
const L_EYE_TOP    = 159   // left eye upper lid
const L_EYE_BOTTOM = 145   // left eye lower lid
const R_EYE_TOP    = 386   // right eye upper lid
const R_EYE_BOTTOM = 374   // right eye lower lid

// Eye corners (for normalizing aperture)
const L_EYE_INNER = 133
const L_EYE_OUTER = 33
const R_EYE_INNER = 362
const R_EYE_OUTER = 263

// Mouth
const MOUTH_TOP    = 13    // upper lip center
const MOUTH_BOTTOM = 14    // lower lip center
const MOUTH_LEFT   = 61    // left corner
const MOUTH_RIGHT  = 291   // right corner

// Eyebrows
const L_BROW_TOP   = 105   // left brow peak
const L_BROW_REF   = 33    // reference (left eye outer)
const R_BROW_TOP   = 334   // right brow peak
const R_BROW_REF   = 263   // reference (right eye outer)

// Face oval for bounding box
const FACE_TOP     = 10
const FACE_BOTTOM  = 152
const FACE_LEFT    = 234
const FACE_RIGHT   = 454

// Head orientation reference points
const NOSE_TIP     = 1
const FOREHEAD     = 10
const CHIN         = 152
const LEFT_CHEEK   = 234
const RIGHT_CHEEK  = 454

// ─── Module state ───────────────────────────────────────────────────────────

let faceLandmarker = null
let ready = false

/**
 * Initialize the MediaPipe FaceLandmarker.
 * Loads the WASM runtime + model from the CDN.
 * @returns {Promise<void>}
 */
export async function initFaceMesh() {
	const { FaceLandmarker, FilesetResolver } = await import(
		'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.18/vision_bundle.mjs'
	)

	const vision = await FilesetResolver.forVisionTasks(
		'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.18/wasm'
	)

	faceLandmarker = await FaceLandmarker.createFromOptions(vision, {
		baseOptions: {
			modelAssetPath:
				'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task',
			delegate: 'GPU'
		},
		runningMode: 'VIDEO',
		numFaces: 1,
		outputFaceBlendshapes: true,
		outputFacialTransformationMatrixes: true
	})

	ready = true
}

/**
 * @returns {boolean} true when the model is loaded and ready
 */
export function isMeshReady() {
	return ready
}

/**
 * Run face detection on a video frame and return expression metrics.
 *
 * @param {HTMLVideoElement} video — live webcam feed
 * @returns {object|null} expression metrics, or null if no face found
 */
export function detectFace(video) {
	if (!faceLandmarker || !ready) return null
	if (video.readyState < 2) return null

	const result = faceLandmarker.detectForVideo(video, performance.now())

	if (!result.faceLandmarks || result.faceLandmarks.length === 0) return null

	const lm = result.faceLandmarks[0]
	const vw = video.videoWidth
	const vh = video.videoHeight

	// ── Expression metrics ──────────────────────────────────────────────

	// Eye openness (normalized by eye width)
	const leftEyeWidth  = dist(lm[L_EYE_OUTER], lm[L_EYE_INNER])
	const leftEyeHeight = dist(lm[L_EYE_TOP], lm[L_EYE_BOTTOM])
	const leftEyeOpen   = clamp01(leftEyeHeight / (leftEyeWidth + 1e-6) / 0.28)

	const rightEyeWidth  = dist(lm[R_EYE_OUTER], lm[R_EYE_INNER])
	const rightEyeHeight = dist(lm[R_EYE_TOP], lm[R_EYE_BOTTOM])
	const rightEyeOpen   = clamp01(rightEyeHeight / (rightEyeWidth + 1e-6) / 0.28)

	// Mouth
	const mouthH    = dist(lm[MOUTH_TOP], lm[MOUTH_BOTTOM])
	const mouthW    = dist(lm[MOUTH_LEFT], lm[MOUTH_RIGHT])
	const faceH     = dist(lm[FACE_TOP], lm[FACE_BOTTOM])
	const mouthOpen = clamp01(mouthH / (faceH + 1e-6) / 0.15)
	const mouthWidth = clamp01(mouthW / (faceH + 1e-6) / 0.45)

	// Eyebrows
	const leftBrowDist  = lm[L_BROW_REF].y - lm[L_BROW_TOP].y
	const rightBrowDist = lm[R_BROW_REF].y - lm[R_BROW_TOP].y
	const leftBrowRaise  = clamp01(leftBrowDist / (faceH + 1e-6) / 0.12)
	const rightBrowRaise = clamp01(rightBrowDist / (faceH + 1e-6) / 0.12)

	// Head rotation (using blendshapes if available, else geometric)
	let headYaw = 0, headPitch = 0, headRoll = 0

	if (result.facialTransformationMatrixes && result.facialTransformationMatrixes.length > 0) {
		const m = result.facialTransformationMatrixes[0].data
		// Extract Euler angles from the 4×4 transformation matrix
		headYaw   = Math.atan2(m[8], m[0])
		headPitch = Math.atan2(-m[4], Math.sqrt(m[5] * m[5] + m[6] * m[6]))
		headRoll  = Math.atan2(m[1], m[0])
	} else {
		// Fallback: geometric approximation
		headYaw  = (lm[NOSE_TIP].x - (lm[LEFT_CHEEK].x + lm[RIGHT_CHEEK].x) / 2) * 4
		headPitch = (lm[NOSE_TIP].y - (lm[FOREHEAD].y + lm[CHIN].y) / 2) * 4
	}

	// ── Bounding box (pixel coords) ─────────────────────────────────────

	let minX = 1, minY = 1, maxX = 0, maxY = 0
	for (const p of lm) {
		if (p.x < minX) minX = p.x
		if (p.y < minY) minY = p.y
		if (p.x > maxX) maxX = p.x
		if (p.y > maxY) maxY = p.y
	}

	// Add some padding (15%)
	const padX = (maxX - minX) * 0.15
	const padY = (maxY - minY) * 0.15
	minX = Math.max(0, minX - padX)
	minY = Math.max(0, minY - padY)
	maxX = Math.min(1, maxX + padX)
	maxY = Math.min(1, maxY + padY)

	// Make it square (use the larger dimension)
	let bw = maxX - minX
	let bh = maxY - minY
	if (bw > bh) {
		const diff = bw - bh
		minY = Math.max(0, minY - diff / 2)
		maxY = Math.min(1, maxY + diff / 2)
	} else {
		const diff = bh - bw
		minX = Math.max(0, minX - diff / 2)
		maxX = Math.min(1, maxX + diff / 2)
	}

	const faceBox = {
		x: minX * vw,
		y: minY * vh,
		w: (maxX - minX) * vw,
		h: (maxY - minY) * vh
	}

	// ── Blendshape values (if available) ────────────────────────────────
	let blendshapes = null
	if (result.faceBlendshapes && result.faceBlendshapes.length > 0) {
		blendshapes = {}
		for (const bs of result.faceBlendshapes[0].categories) {
			blendshapes[bs.categoryName] = bs.score
		}
	}

	return {
		leftEyeOpen,
		rightEyeOpen,
		mouthOpen,
		mouthWidth,
		leftBrowRaise,
		rightBrowRaise,
		headYaw,
		headPitch,
		headRoll,
		faceBox,
		landmarks: lm,
		blendshapes
	}
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function dist(a, b) {
	const dx = a.x - b.x
	const dy = a.y - b.y
	return Math.sqrt(dx * dx + dy * dy)
}

function clamp01(v) {
	return Math.max(0, Math.min(1, v))
}
