/**
 * Ritual state machine — gesture-only interaction for Send-a-Pixel.
 *
 * States:
 *   IDLE     → no hand detected, object breathes calmly
 *   READY    → hand present, object "notices" you
 *   CHARGING → pinch held, energy accumulates, core forms
 *   RELEASE  → pinch opens after charge, event is born
 *   RECEIVING→ remote event arriving and merging
 *
 * Outputs SDF parameter updates each frame based on gesture features.
 * Rate-limits releases to prevent spam.
 */

// ─── States ──────────────────────────────────────────────────────────────────

export const State = {
	IDLE: 'idle',
	READY: 'ready',
	CHARGING: 'charging',
	RELEASE: 'release',
	RECEIVING: 'receiving'
}

// ─── Configuration ───────────────────────────────────────────────────────────

const CHARGE_RATE = 0.4          // energy gained per second while pinched
const CHARGE_DECAY = 0.15        // energy lost per second when not pinching
const MIN_RELEASE_ENERGY = 0.2   // minimum energy to trigger a release
const RELEASE_COOLDOWN = 5.0     // seconds between releases
const RELEASE_ANIM_DURATION = 2.0 // seconds for release animation
const RECEIVE_ANIM_DURATION = 3.0 // seconds for receive animation
const SYNC_WINDOW = 30.0         // seconds for sync detection
const SYNC_LOCK_DURATION = 2.5   // seconds the sync visual holds
const PINCH_THRESHOLD = 0.6      // pinch value above which = "pinching"

// ─── Internal state ──────────────────────────────────────────────────────────

let currentState = State.IDLE
let energy = 0
let lastReleaseTime = -Infinity
let releaseTimer = 0
let receiveTimer = 0
let receiveEvent = null
let syncTimer = 0
let lastLocalReleaseTime = -Infinity
let lastRemoteReleaseTime = -Infinity

// ─── Pending release event (for transmission) ────────────────────────────────

let pendingRelease = null

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Get the current ritual state.
 * @returns {string}
 */
export function getState() {
	return currentState
}

/**
 * Get the current energy level.
 * @returns {number} 0..1
 */
export function getEnergy() {
	return energy
}

/**
 * Check and consume a pending release event.
 * @returns {{ seed: number, energy: number }|null}
 */
export function consumeRelease() {
	const r = pendingRelease
	pendingRelease = null
	return r
}

/**
 * Inject a remote event (from another device).
 * @param {number} seed
 * @param {number} remoteEnergy - 0..1
 */
export function receiveRemoteEvent(seed, remoteEnergy) {
	receiveEvent = { seed, energy: remoteEnergy }
	receiveTimer = RECEIVE_ANIM_DURATION
	currentState = State.RECEIVING
	lastRemoteReleaseTime = performance.now() / 1000
}

/**
 * Update the ritual state machine.
 * Call every frame with gesture features and SDF params to mutate.
 *
 * @param {object} gesture - From hand.js detect()
 * @param {object} sdfParams - SDF params object to mutate
 * @param {number} dt - Delta time in seconds
 * @param {Function} addScar - Function to add a scar to SDF
 */
export function update(gesture, sdfParams, dt, addScar) {
	const handPresent = gesture ? gesture.handPresent : false
	const pinch = gesture ? gesture.pinch : 0
	const handCenter = gesture ? gesture.handCenter : { x: 0.5, y: 0.5 }
	const handSpeed = gesture ? gesture.handSpeed : 0
	const nowSec = performance.now() / 1000

	// ── Sync decay ───────────────────────────────────────────────────────
	if (syncTimer > 0) {
		syncTimer -= dt
		sdfParams.syncLock = Math.max(0, syncTimer / SYNC_LOCK_DURATION)
	} else {
		sdfParams.syncLock *= 0.95
	}

	// ── State machine ────────────────────────────────────────────────────

	switch (currentState) {

		// ─────────────────────────────────────────────────────────────────
		case State.IDLE:
			// Decay everything to calm baseline
			energy *= (1 - CHARGE_DECAY * dt * 2)
			sdfParams.coreEnergy *= 0.93
			sdfParams.coreFocus *= 0.95
			sdfParams.attention *= 0.92
			sdfParams.bloom *= 0.9
			sdfParams.shockwave *= 0.92

			// Hand appears → transition to READY
			if (handPresent) {
				currentState = State.READY
			}
			break

		// ─────────────────────────────────────────────────────────────────
		case State.READY:
			// Object notices the hand
			sdfParams.attention += (0.3 - sdfParams.attention) * 0.1
			sdfParams.handDir.x = (handCenter.x - 0.5) * 2
			sdfParams.handDir.y = (handCenter.y - 0.5) * 2

			// Slight contrast boost (brighten base hue saturation)
			sdfParams.coreFocus += (0.1 - sdfParams.coreFocus) * 0.1

			// Energy decays gently
			energy *= (1 - CHARGE_DECAY * dt * 0.5)
			sdfParams.coreEnergy *= 0.95

			// Bloom / shockwave decay
			sdfParams.bloom *= 0.92
			sdfParams.shockwave *= 0.93

			if (!handPresent) {
				currentState = State.IDLE
			} else if (pinch > PINCH_THRESHOLD) {
				currentState = State.CHARGING
			}
			break

		// ─────────────────────────────────────────────────────────────────
		case State.CHARGING:
			// Accumulate energy
			energy = Math.min(1, energy + CHARGE_RATE * dt)

			// Core forms inside
			sdfParams.coreEnergy += (energy - sdfParams.coreEnergy) * 0.15
			sdfParams.coreFocus += (energy * 0.8 - sdfParams.coreFocus) * 0.1

			// Attention stays high
			sdfParams.attention += (0.5 + energy * 0.3 - sdfParams.attention) * 0.1
			sdfParams.handDir.x = (handCenter.x - 0.5) * 2
			sdfParams.handDir.y = (handCenter.y - 0.5) * 2

			// Micro-jitter → domain warp (hand tremor becomes texture)
			sdfParams.warpAmount = 0.2 - energy * 0.15 + handSpeed * 0.1

			// Bloom / shockwave decay
			sdfParams.bloom *= 0.95
			sdfParams.shockwave *= 0.95

			if (!handPresent) {
				// Hand lost during charge — decay, go idle
				currentState = State.IDLE
			} else if (pinch < PINCH_THRESHOLD * 0.7) {
				// Pinch released → attempt release
				if (energy >= MIN_RELEASE_ENERGY &&
				    (nowSec - lastReleaseTime) > RELEASE_COOLDOWN) {
					triggerRelease(nowSec, sdfParams, addScar)
				} else {
					// Not enough energy or cooldown — go back to ready
					currentState = State.READY
				}
			}
			break

		// ─────────────────────────────────────────────────────────────────
		case State.RELEASE:
			releaseTimer -= dt
			const releaseProgress = 1 - (releaseTimer / RELEASE_ANIM_DURATION)

			if (releaseProgress < 0.1) {
				// Snap: core crystallizes
				sdfParams.coreEnergy = 1.0
				sdfParams.coreFocus = 1.0
				sdfParams.bloom = 1.0
			} else if (releaseProgress < 0.5) {
				// Bloom → shockwave inward
				sdfParams.bloom *= 0.85
				sdfParams.shockwave = (releaseProgress - 0.1) / 0.4
				sdfParams.shockPhase = (releaseProgress - 0.1) / 0.4 * PI
			} else {
				// Assimilate — settle back
				sdfParams.bloom *= 0.9
				sdfParams.shockwave *= 0.9
				sdfParams.coreEnergy *= 0.92
				sdfParams.coreFocus *= 0.93
			}

			// Hand tracking continues
			if (handPresent) {
				sdfParams.handDir.x = (handCenter.x - 0.5) * 2
				sdfParams.handDir.y = (handCenter.y - 0.5) * 2
			}

			energy *= 0.95

			if (releaseTimer <= 0) {
				currentState = handPresent ? State.READY : State.IDLE
			}
			break

		// ─────────────────────────────────────────────────────────────────
		case State.RECEIVING:
			receiveTimer -= dt
			const recvProgress = 1 - (receiveTimer / RECEIVE_ANIM_DURATION)

			if (receiveEvent) {
				sdfParams.remoteCore = Math.min(1, receiveEvent.energy * 1.2)
				sdfParams.remoteSeed = receiveEvent.seed
				sdfParams.remotePhase = easeInOut(recvProgress)
			}

			// As it merges, subtle bloom
			if (recvProgress > 0.7) {
				sdfParams.remoteCore *= 0.9
				sdfParams.bloom = (recvProgress - 0.7) / 0.3 * 0.4
			}

			if (receiveTimer <= 0) {
				// Merge complete — add scar
				if (receiveEvent && addScar) {
					addScar(receiveEvent.seed, receiveEvent.energy)
				}
				sdfParams.remoteCore = 0
				sdfParams.remotePhase = 0
				sdfParams.bloom *= 0.5
				receiveEvent = null
				currentState = handPresent ? State.READY : State.IDLE

				// Check sync
				checkSync(sdfParams)
			}
			break
	}

	// ── Clamp all params ─────────────────────────────────────────────────
	sdfParams.coreEnergy = clamp01(sdfParams.coreEnergy)
	sdfParams.coreFocus = clamp01(sdfParams.coreFocus)
	sdfParams.attention = clamp01(sdfParams.attention)
	sdfParams.bloom = clamp01(sdfParams.bloom)
	sdfParams.shockwave = clamp01(sdfParams.shockwave)
	sdfParams.remoteCore = clamp01(sdfParams.remoteCore)
	sdfParams.remotePhase = clamp01(sdfParams.remotePhase)
}

// ─── Internal ────────────────────────────────────────────────────────────────

function triggerRelease(nowSec, sdfParams, addScar) {
	const seed = Math.floor(Math.random() * 65536)
	const releaseEnergy = energy

	pendingRelease = { seed, energy: releaseEnergy }
	lastReleaseTime = nowSec
	lastLocalReleaseTime = nowSec
	releaseTimer = RELEASE_ANIM_DURATION
	currentState = State.RELEASE

	// Add scar from own release
	if (addScar) {
		addScar(seed, releaseEnergy)
	}

	// Reset energy
	energy = 0
}

function checkSync(sdfParams) {
	const nowSec = performance.now() / 1000
	const localAge = nowSec - lastLocalReleaseTime
	const remoteAge = nowSec - lastRemoteReleaseTime

	if (localAge < SYNC_WINDOW && remoteAge < SYNC_WINDOW) {
		// Both released within the window → sync moment
		syncTimer = SYNC_LOCK_DURATION
		sdfParams.syncLock = 1.0
	}
}

function clamp01(x) { return x < 0 ? 0 : (x > 1 ? 1 : x) }

function easeInOut(t) {
	return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2
}
