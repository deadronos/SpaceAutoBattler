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
