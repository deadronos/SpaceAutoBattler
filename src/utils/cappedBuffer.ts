/**
 * Append an entry to a buffer and trim excess elements from the head so the buffer never exceeds `cap`.
 * Returns the same buffer reference for convenience.
 *
 * @template T - The type of elements in the buffer.
 * @param {T[]} buffer - The mutable array buffer to append to.
 * @param {T} entry - The entry to append.
 * @param {number} cap - The maximum number of elements allowed in the buffer.
 * @returns {T[]} The modified buffer.
 * @throws {TypeError} If buffer is not an array.
 */
export function appendCappedMutable<T>(buffer: T[], entry: T, cap: number): T[] {
  if (!Array.isArray(buffer)) {
    throw new TypeError('appendCappedMutable expects a mutable array buffer.');
  }

  const normalisedCap = normalizeCap(cap);
  if (normalisedCap === 0) {
    buffer.length = 0;
    return buffer;
  }

  buffer.push(entry);
  const overflow = buffer.length - normalisedCap;
  if (overflow > 0) {
    buffer.splice(0, overflow);
  }
  return buffer;
}

/**
 * Append with the same semantics as {@link appendCappedMutable} but without mutating the input reference.
 * Undefined or null buffers are treated as empty arrays.
 *
 * @template T - The type of elements in the buffer.
 * @param {readonly T[] | undefined | null} buffer - The input buffer (or null/undefined).
 * @param {T} entry - The entry to append.
 * @param {number} cap - The maximum number of elements allowed in the buffer.
 * @returns {T[]} A new array containing the updated buffer contents.
 */
export function appendCappedImmutable<T>(
  buffer: readonly T[] | undefined | null,
  entry: T,
  cap: number,
): T[] {
  const clone = Array.isArray(buffer) ? [...buffer] : [];
  return appendCappedMutable(clone, entry, cap);
}

function normalizeCap(cap: number): number {
  if (!Number.isFinite(cap)) return 0;
  const integerCap = Math.floor(cap);
  return integerCap > 0 ? integerCap : 0;
}
