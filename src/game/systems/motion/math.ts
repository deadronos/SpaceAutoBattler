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
 * Calculates a damping factor for a given time step.
 *
 * @param {number} damping - The damping coefficient.
 * @param {number} dt - The time step.
 * @returns {number} The multiplicative damping factor (0..1).
 */
export function dampingFactor(damping: number, dt: number): number {
  return Math.exp(-damping * dt);
}
