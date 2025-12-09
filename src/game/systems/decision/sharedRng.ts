import { SeededRng } from '../../../utils/rng.js';

/**
 * Module-level temporary RNG shared across decision subsystem utilities
 * to ensure deterministic behavior across AI decision-making.
 */
export const TEMP_RNG = new SeededRng(1);

/**
 * Reset the module-level temporary RNG used for incidental randomness in
 * decision utilities. Tests and harnesses can call this to ensure runs are
 * independent from previous test ordering.
 *
 * @param {number} [seed=1] - The seed to reset to.
 */
export function resetTempRng(seed?: number): void {
  TEMP_RNG.reset(seed ?? 1);
}
