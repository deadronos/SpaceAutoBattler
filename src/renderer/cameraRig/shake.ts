/**
 * Pure trauma/shake math for the camera rig.
 *
 * This module is deliberately free of React and three imports so the model can
 * be unit-tested in isolation and reused by the render-only `<CameraRig />`
 * component. Everything here is arithmetic on the passed-in state object: no
 * randomness, no module-level state, and no simulation writes.
 */

/** Maximum accumulated trauma (classic 0..1 trauma model). */
export const TRAUMA_MAX = 1;
/** Trauma lost per second of sim time. */
export const TRAUMA_DECAY_PER_SEC = 1.4;
/** Radius (world units) that maps to full trauma; bigger blasts clamp. */
export const TRAUMA_RADIUS_REF = 14;
/** Maximum FOV kick in degrees. */
export const FOV_KICK_MAX_DEG = 3;
/** FOV kick lost per second of sim time. */
export const FOV_KICK_DECAY_PER_SEC = 6;
/** Radius at/above which a blast also triggers the FOV kick. */
export const FOV_KICK_RADIUS_THRESHOLD = 10;

/** Flash intensity that maps to a neutral (1.0) trauma scale. */
const FLASH_INTENSITY_REF = 1.2;
/** Keeps the optional flash contribution mild so it nudges rather than dominates. */
const FLASH_FACTOR_MIN = 0.5;
const FLASH_FACTOR_MAX = 1.5;

/**
 * Accumulated trauma and pending FOV kick for the camera rig.
 */
export interface TraumaState {
  /** Current trauma in the range 0..TRAUMA_MAX. */
  trauma: number;
  /** Current FOV kick in the range 0..FOV_KICK_MAX_DEG. */
  fovKick: number;
}

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  if (value < min) return min;
  if (value > max) return max;
  return value;
}

function clamp01(value: number): number {
  return clamp(value, 0, 1);
}

/**
 * Creates a fresh, zeroed trauma state.
 *
 * @returns {TraumaState} A new trauma state with no shake or FOV kick.
 */
export function createTraumaState(): TraumaState {
  return { trauma: 0, fovKick: 0 };
}

/**
 * Adds trauma from an explosion radius and, optionally, a flash-intensity
 * scale. The radius maps linearly onto `0..1` against `TRAUMA_RADIUS_REF`
 * (larger blasts clamp), then the flash factor mildly scales the contribution.
 * The running total is clamped to `TRAUMA_MAX`.
 *
 * @param {TraumaState} s - Trauma state to mutate.
 * @param {number} radius - Explosion radius in world units.
 * @param {number} [flashIntensity] - Optional flash intensity from the event.
 */
export function addExplosionTrauma(s: TraumaState, radius: number, flashIntensity?: number): void {
  const radiusFactor = clamp01(radius / TRAUMA_RADIUS_REF);
  const flashFactor =
    flashIntensity === undefined
      ? 1
      : clamp(flashIntensity / FLASH_INTENSITY_REF, FLASH_FACTOR_MIN, FLASH_FACTOR_MAX);
  s.trauma = clamp01(s.trauma + radiusFactor * flashFactor);
}

/**
 * Decays trauma and FOV kick by a sim-time delta. Negative or non-finite deltas
 * are ignored; both values floor at 0.
 *
 * @param {TraumaState} s - Trauma state to mutate.
 * @param {number} dt - Sim-time delta in seconds.
 */
export function updateTrauma(s: TraumaState, dt: number): void {
  if (!Number.isFinite(dt) || dt <= 0) return;
  s.trauma = Math.max(0, s.trauma - TRAUMA_DECAY_PER_SEC * dt);
  s.fovKick = Math.max(0, s.fovKick - FOV_KICK_DECAY_PER_SEC * dt);
}

/**
 * Amplitude curve for shake: `trauma^2`, the classic trauma-shake falloff that
 * keeps small hits subtle and makes big hits read clearly.
 *
 * @param {number} trauma - Trauma value (clamped to 0..1 before squaring).
 * @returns {number} Shake amplitude in the range 0..1.
 */
export function traumaAmplitude(trauma: number): number {
  const t = clamp01(trauma);
  return t * t;
}

/**
 * Whether a blast is large enough to also trigger the FOV kick.
 *
 * @param {number} radius - Explosion radius in world units.
 * @returns {boolean} True when the blast is at/above the kick threshold.
 */
export function isFovKickBlast(radius: number): boolean {
  return radius >= FOV_KICK_RADIUS_THRESHOLD;
}

/**
 * Adds an FOV kick, clamped to `0..FOV_KICK_MAX_DEG`.
 *
 * @param {TraumaState} s - Trauma state to mutate.
 * @param {number} degrees - Degrees of kick to add.
 */
export function addFovKick(s: TraumaState, degrees: number): void {
  s.fovKick = clamp(s.fovKick + degrees, 0, FOV_KICK_MAX_DEG);
}

/** Minimal read-only view of an explosion event used by the cursor helpers. */
export interface ExplosionLike {
  /** Monotonic id assigned when the event was emitted. */
  id: number;
  /** Explosion radius in world units. */
  radius: number;
  /** Optional flash intensity from the event. */
  flashIntensity?: number;
}

/** Highest explosion id at/after `cursor` (never lowers the cursor). */
export function maxExplosionId(events: readonly ExplosionLike[], cursor: number): number {
  let max = cursor;
  for (const event of events) {
    if (event.id > max) max = event.id;
  }
  return max;
}

/** Highest explosion id present in the list only (`-Infinity` when empty). */
function listMaxExplosionId(events: readonly ExplosionLike[]): number {
  let max = Number.NEGATIVE_INFINITY;
  for (const event of events) {
    if (event.id > max) max = event.id;
  }
  return max;
}

/**
 * Advances the explosion cursor and accrues trauma/FOV kick from events newer
 * than `cursor`.
 *
 * A simulation reset clears the list and restarts ids at 1, so the previous
 * cursor can be higher than every new id. Two guards handle that:
 * - an empty list resets the cursor to 0, so the first kill of the new match
 *   still shakes;
 * - if the first post-reset frame already has events, all ids below the cursor
 *   are treated as a reset and the cursor is re-synced to the list max without
 *   adding trauma.
 *
 * @param {readonly ExplosionLike[]} events - Active explosion events.
 * @param {number} cursor - Last explosion id already accounted for.
 * @param {TraumaState} s - Trauma state to mutate.
 * @returns {number} The updated explosion cursor.
 */
export function advanceExplosionCursor(
  events: readonly ExplosionLike[],
  cursor: number,
  s: TraumaState,
): number {
  if (events.length === 0) return 0;

  let next = cursor;
  const listMax = listMaxExplosionId(events);
  if (listMax < cursor) {
    // Ids moved backwards: treat as a reset and adopt the new list max.
    next = listMax;
  }

  for (const event of events) {
    if (event.id <= next) continue;
    addExplosionTrauma(s, event.radius, event.flashIntensity);
    if (isFovKickBlast(event.radius)) {
      addFovKick(s, FOV_KICK_MAX_DEG);
    }
    next = event.id;
  }

  return next;
}
