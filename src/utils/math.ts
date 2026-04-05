import type { Vector3 } from 'three';
/**
 * Math utility functions to reduce duplication across the codebase.
 */

/**
 * Clamps a value between a minimum and maximum bound.
 *
 * @param {number} value - The value to clamp.
 * @param {number} min - The lower bound.
 * @param {number} max - The upper bound.
 * @returns {number} The clamped value.
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/**
 * Clamps a value between 0 and 1.
 * Returns 0 for NaN values.
 *
 * @param {number} value - The value to clamp.
 * @returns {number} The clamped value in [0, 1].
 */
export function clamp01(value: number): number {
  if (Number.isNaN(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

/**
 * Clamps a ratio value between 0 and 1.
 * Returns 0 for non-finite values (Infinity, NaN).
 *
 * @param {number} value - The value to clamp.
 * @returns {number} The clamped value in [0, 1].
 */
export function clampRatio(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(Math.max(value, 0), 1);
}

/**
 * Calculates the shortest signed angle between two angles in radians.
 *
 * @param {number} from - The start angle.
 * @param {number} to - The end angle.
 * @returns {number} The shortest difference in [-PI, PI].
 */
export function shortestAngle(from: number, to: number): number {
  let diff = to - from;
  while (diff > Math.PI) diff -= 2 * Math.PI;
  while (diff < -Math.PI) diff += 2 * Math.PI;
  return diff;
}


/**
 * Solves the quadratic equation for intercepting a moving target.
 *
 * @param {Vector3} relativePos - Target position minus shooter position.
 * @param {Vector3} relativeVel - Target velocity minus shooter velocity.
 * @param {number} projectileSpeed - Speed of the projectile.
 * @returns {number} The time to intercept, or 0 if no valid intercept.
 */
export function solveInterceptQuadratic(
  relativePos: Vector3,
  relativeVel: Vector3,
  projectileSpeed: number,
): number {
  const speed = Math.max(0, projectileSpeed);
  const a = relativeVel.lengthSq() - speed * speed;
  const b = 2 * relativePos.dot(relativeVel);
  const c = relativePos.lengthSq();

  if (Math.abs(a) < 1e-6) {
    if (Math.abs(b) > 1e-6) {
      return Math.max(0, -c / b);
    }
    return 0;
  }

  const discriminant = b * b - 4 * a * c;
  if (discriminant >= 0) {
    const sqrt = Math.sqrt(discriminant);
    const t1 = (-b - sqrt) / (2 * a);
    const t2 = (-b + sqrt) / (2 * a);
    let t = Math.min(t1, t2);
    if (t < 0) t = Math.max(t1, t2);
    return Math.max(0, t);
  }

  return 0;
}
