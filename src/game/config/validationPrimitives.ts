/**
 * Shared predicate and formatting primitives for pure config/tunable validators.
 */

/**
 * Returns true when `value` is a finite number.
 *
 * @param {unknown} value - Candidate value to check.
 * @returns {value is number} True if `value` is a finite number.
 */
export function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

/**
 * Returns true when `value` is a finite number strictly greater than zero.
 *
 * @param {unknown} value - Candidate value to check.
 * @returns {value is number} True if `value > 0` and finite.
 */
export function isPositiveFinite(value: unknown): value is number {
  return isFiniteNumber(value) && value > 0;
}

/**
 * Returns true when `value` is a finite number in the closed unit interval `[0, 1]`.
 *
 * @param {unknown} value - Candidate value to check.
 * @returns {value is number} True if `0 <= value <= 1`.
 */
export function isInUnitInterval(value: unknown): value is number {
  return isFiniteNumber(value) && value >= 0 && value <= 1;
}

/**
 * Returns true when `value` is a finite number greater than or equal to zero.
 *
 * @param {unknown} value - Candidate value to check.
 * @returns {value is number} True if `value >= 0` and finite.
 */
export function isNonNegativeFinite(value: unknown): value is number {
  return isFiniteNumber(value) && value >= 0;
}

/**
 * Formats an unknown value for human-readable validation messages.
 *
 * @param {unknown} value - Value to describe.
 * @returns {string} Compact type/value representation.
 */
export function describe(value: unknown): string {
  if (typeof value === 'number') return String(value);
  if (typeof value === 'string') return JSON.stringify(value);
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  return typeof value;
}
