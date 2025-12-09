import { SeededRng } from './rng.js';

const GOLDEN = 0x9e3779b9;

/**
 * Generates a deterministic smoothing factor based on a seed.
 * Used to vary interpolation speeds per entity without syncing state.
 *
 * @param {number} seed - The seed value (e.g., entity ID).
 * @returns {number} A smoothing factor between approx 0.35 and 0.7.
 */
export function smoothingFactorFromSeed(seed: number): number {
  const rng = new SeededRng((seed ^ GOLDEN) >>> 0);
  // Bias towards faster easing while keeping deterministic variance per ship.
  return 0.35 + rng.next() * 0.35;
}

/**
 * Linearly interpolates a value using a deterministic factor derived from a seed.
 *
 * @param {number} seed - The seed to derive the interpolation factor from.
 * @param {number} previous - The start value.
 * @param {number} target - The end value.
 * @returns {number} The interpolated value.
 */
export function lerpBySeed(seed: number, previous: number, target: number): number {
  if (!Number.isFinite(previous) || !Number.isFinite(target)) {
    return target;
  }
  const factor = smoothingFactorFromSeed(seed);
  return previous + (target - previous) * factor;
}
