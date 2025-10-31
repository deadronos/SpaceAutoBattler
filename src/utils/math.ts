/**
 * Math utility functions to reduce duplication across the codebase.
 */

/**
 * Clamps a value between min and max.
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/**
 * Clamps a value between 0 and 1.
 * Returns 0 for NaN values.
 */
export function clamp01(value: number): number {
  if (Number.isNaN(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

/**
 * Clamps a ratio value between 0 and 1.
 * Returns 0 for non-finite values.
 */
export function clampRatio(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(Math.max(value, 0), 1);
}
