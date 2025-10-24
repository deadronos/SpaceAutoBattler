/**
 * Star disk utility functions
 *
 * Pure functions for time wrapping and debug detection used by the StarDisk component.
 */

/** Time wrap period in seconds to prevent precision loss in shader uniforms */
export const STAR_TIME_WRAP_SECONDS = 8192;

/**
 * Wrap elapsed time to prevent floating-point precision loss in shader uniforms.
 *
 * @param time - Elapsed time in seconds
 * @returns Object with wrapped time and number of complete cycles
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

/**
 * Check if Copilot debug mode is enabled via query parameter or window flag.
 *
 * @returns true if debug mode is active
 */
export function isCopilotDebugEnabled(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }
  try {
    const win = window as Window & { __copilotDebugForce?: boolean };
    if (win.__copilotDebugForce) {
      return true;
    }
    const search = typeof win.location?.search === 'string' ? win.location.search : '';
    return /[?&]copilot_debug=1/.test(search);
  } catch {
    return false;
  }
}
