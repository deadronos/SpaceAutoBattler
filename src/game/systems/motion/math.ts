export { shortestAngle } from '../../../utils/math.js';

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
