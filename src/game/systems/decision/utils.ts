/**
 * Hashes a number to a 32-bit integer.
 * Useful for deterministic seeding based on IDs.
 *
 * @param {number} value - The input number.
 * @returns {number} The hashed integer.
 */
export function hashToInt(value: number): number {
  let x = value >>> 0;
  x ^= x << 13;
  x ^= x >>> 17;
  x ^= x << 5;
  return x | 0;
}
