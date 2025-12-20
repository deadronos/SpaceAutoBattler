import { Quaternion, Vector3 } from 'three';
import { clamp } from './math.js';

/** Global forward vector (0, 0, 1). */
export const FORWARD = new Vector3(0, 0, 1);
const DEFAULT_FALLBACK = new Vector3(0, 0, 1);
const TEMP_DIR = new Vector3();
const TEMP_LEAD = new Vector3();

/**
 * Normalizes a vector safely, handling zero-length vectors by falling back to a default.
 *
 * @param {Vector3} dst - The destination vector to store the result.
 * @param {Vector3} src - The source vector to normalize.
 * @param {Vector3} [fallback=DEFAULT_FALLBACK] - The fallback vector to use if src length is near zero.
 * @returns {Vector3} The normalized destination vector.
 */
export function safeNormalize(
  dst: Vector3,
  src: Vector3,
  fallback: Vector3 = DEFAULT_FALLBACK,
): Vector3 {
  if (src.lengthSq() > 1e-12) {
    if (dst !== src) {
      dst.copy(src);
    }
    return dst.normalize();
  }
  if (fallback.lengthSq() > 1e-12) {
    dst.copy(fallback);
    return dst.normalize();
  }
  dst.set(0, 0, 1);
  return dst;
}

/**
 * Computes a rotation quaternion that orients an object towards a direction.
 *
 * @param {Vector3} direction - The target direction vector.
 * @param {Vector3} [fallbackDirection=DEFAULT_FALLBACK] - Fallback direction if the primary direction is invalid.
 * @param {Quaternion} [target=new Quaternion()] - The quaternion to store the result.
 * @returns {Quaternion} The computed rotation quaternion.
 */
export function orientQuaternionFromDirection(
  direction: Vector3,
  fallbackDirection: Vector3 = DEFAULT_FALLBACK,
  target = new Quaternion(),
): Quaternion {
  const normalised = safeNormalize(TEMP_DIR, direction, fallbackDirection);
  target.setFromUnitVectors(FORWARD, normalised);
  if (!Number.isFinite(target.x) || !Number.isFinite(target.y) || !Number.isFinite(target.z)) {
    return target.identity();
  }
  return target;
}

/**
 * Calculates a lead direction to intercept a moving target.
 *
 * @param {Vector3} targetPos - The current position of the target.
 * @param {Vector3} sourcePos - The position of the source (shooter).
 * @param {Vector3} targetVelocity - The velocity vector of the target.
 * @param {number} [leadFactor=0.5] - Scalar to adjust the amount of lead (prediction).
 * @param {Vector3} [out=new Vector3()] - The vector to store the result.
 * @returns {Vector3} The normalized direction vector aiming at the predicted position.
 */
export function computeLeadDirection(
  targetPos: Vector3,
  sourcePos: Vector3,
  targetVelocity: Vector3,
  leadFactor = 0.5,
  out: Vector3 = new Vector3(),
): Vector3 {
  TEMP_DIR.copy(targetPos).sub(sourcePos);
  safeNormalize(out, TEMP_DIR, FORWARD);

  if (leadFactor !== 0 && targetVelocity.lengthSq() > 1e-10) {
    safeNormalize(TEMP_LEAD, targetVelocity, FORWARD).multiplyScalar(leadFactor);
    out.add(TEMP_LEAD);
    safeNormalize(out, out, FORWARD);
  }

  return out;
}

/**
 * Steers a vector towards a desired direction with a limited turn rate.
 *
 * @param {Vector3} currentDir - The current direction vector.
 * @param {Vector3} desiredDir - The desired direction vector.
 * @param {number} turnRate - The maximum turn rate in radians per second.
 * @param {number} delta - The time step in seconds.
 * @param {Vector3} [out=new Vector3()] - The vector to store the result.
 * @returns {{ newDir: Vector3; angle: number }} Object containing the new direction and the remaining angle to target.
 */
export function steerDirection(
  currentDir: Vector3,
  desiredDir: Vector3,
  turnRate: number,
  delta: number,
  out: Vector3 = new Vector3(),
): number {
  const angle = currentDir.angleTo(desiredDir);
  if (!Number.isFinite(angle) || angle < 1e-6) {
    safeNormalize(out, currentDir, desiredDir);
    return Math.max(angle, 0);
  }

  const maxTurn = Math.max(0, turnRate) * Math.max(delta, 0);
  if (maxTurn <= 0) {
    safeNormalize(out, currentDir, desiredDir);
    return angle;
  }

  const t = Math.min(1, maxTurn / angle);
  out.copy(currentDir).lerp(desiredDir, t);
  safeNormalize(out, out, desiredDir);
  return angle;
}

/**
 * Clamps an angle within a specified range, normalizing it to [-PI, PI].
 *
 * @param {number} angle - The angle in radians.
 * @param {number} min - The minimum allowed angle.
 * @param {number} max - The maximum allowed angle.
 * @returns {number} The clamped angle.
 */
export function clampAngle(angle: number, min: number, max: number): number {
  if (!Number.isFinite(angle)) {
    return clamp(0, Math.min(min, max), Math.max(min, max));
  }
  const twoPi = Math.PI * 2;
  let normalised = angle % twoPi;
  if (normalised < -Math.PI) normalised += twoPi;
  if (normalised > Math.PI) normalised -= twoPi;

  const minBound = Math.min(min, max);
  const maxBound = Math.max(min, max);
  if (normalised < minBound) return minBound;
  if (normalised > maxBound) return maxBound;
  return normalised;
}
