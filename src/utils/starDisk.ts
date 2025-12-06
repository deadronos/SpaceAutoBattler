/**
 * Star disk utility functions
 *
 * Pure functions for time wrapping used by the StarDisk component.
 */

/** Time wrap period in seconds to prevent precision loss in shader uniforms */
export const STAR_TIME_WRAP_SECONDS = 8192;

/**
 * Wrap elapsed time to prevent floating-point precision loss in shader uniforms.
 *
 * @param {number} time - Elapsed time in seconds.
 * @returns {{ wrapped: number; cycles: number }} Object with wrapped time and number of complete cycles.
 */
export function wrapStarTime(time: number): { wrapped: number; cycles: number } {
  if (!Number.isFinite(time)) {
    return { wrapped: 0, cycles: 0 };
  }
  if (!(STAR_TIME_WRAP_SECONDS > 0)) {
    return { wrapped: time, cycles: 0 };
  }
  const period = STAR_TIME_WRAP_SECONDS;
  const cycles = Math.trunc(time / period);
  let wrapped = time - cycles * period;
  if (wrapped < 0) {
    wrapped += period;
  }
  return { wrapped, cycles };
}

// Re-export for backwards compatibility
export { isCopilotDebugEnabled } from './copilotDebug.js';
