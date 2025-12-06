import { Vector3 } from 'three';
import { hashToInt } from '../utils.js';
import { TEMP_RNG } from '../sharedRng.js';

const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));

// Re-export for backward compatibility
// Tell eslint this exported symbol may be unused locally (it's provided for
// backward-compat consumers) so the no-unused-vars rule doesn't complain.
 
export { resetTempRng } from '../sharedRng.js';

/**
 * Computes a formation offset for an escort ship relative to its VIP.
 * Uses a golden angle spiral distribution on a sphere surface for even coverage.
 *
 * @param {number} vipId - The ID of the VIP ship.
 * @param {number} slotIndex - The index of this escort in the formation.
 * @param {number} total - Total number of escorts.
 * @param {number} radius - Base radius of the formation shell.
 * @returns {Vector3} The computed offset vector.
 */
export const computeEscortShellOffset = (
  vipId: number,
  slotIndex: number,
  total: number,
  radius: number,
): Vector3 => {
  const normalizedTotal = Math.max(1, total);
  const t = (slotIndex + 0.5) / normalizedTotal;
  const inclination = Math.acos(1 - 2 * t);
  const azimuth = GOLDEN_ANGLE * (slotIndex + 1);
  const sinInclination = Math.sin(inclination);
  const base = new Vector3(
    Math.cos(azimuth) * sinInclination,
    Math.cos(inclination),
    Math.sin(azimuth) * sinInclination,
  );
  const jitterSeed = hashToInt(vipId ^ ((slotIndex + 1) * 8191));
  TEMP_RNG.reset(Math.abs(jitterSeed) + 1);
  const radialJitter = 1 + TEMP_RNG.range(-0.08, 0.08);
  const verticalJitter = TEMP_RNG.range(-0.12, 0.12);
  base.y += verticalJitter;
  if (base.lengthSq() < 1e-5) base.set(0, 1, 0);
  base.normalize().multiplyScalar(Math.max(20, radius * radialJitter));
  return base;
};
