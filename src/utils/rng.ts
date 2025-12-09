/**
 * A seeded random number generator for deterministic simulation.
 * Uses a linear congruential generator (Lehmer RNG) compatible with glibc's rand().
 */
export class SeededRng {
  private state = 1;

  /**
   * Creates a new seeded RNG instance.
   *
   * @param {number} seed - The initial seed value.
   */
  constructor(seed: number) {
    this.reset(seed);
  }

  /**
   * Resets the generator with a new seed.
   *
   * @param {number} seed - The new seed value.
   */
  reset(seed: number): void {
    this.state = seed >>> 0;
    if (this.state === 0) {
      this.state = 1;
    }
  }

  /**
   * Generates the next random number in the sequence.
   *
   * @returns {number} A pseudo-random floating-point number between 0 (inclusive) and 1 (exclusive).
   */
  next(): number {
    // Lehmer RNG with glibc parameters
    this.state = (this.state * 48271) % 0x7fffffff;
    return this.state / 0x7fffffff;
  }

  /**
   * Generates a random floating-point number within a specified range.
   *
   * @param {number} min - The minimum value (inclusive).
   * @param {number} max - The maximum value (exclusive).
   * @returns {number} A random number between min and max.
   */
  range(min: number, max: number): number {
    return min + (max - min) * this.next();
  }

  /**
   * Generates a random integer within a specified range.
   *
   * @param {number} min - The minimum value (inclusive).
   * @param {number} max - The maximum value (inclusive).
   * @returns {number} A random integer between min and max.
   */
  int(min: number, max: number): number {
    return Math.floor(this.range(min, max + 1));
  }

  /**
   * Picks a random element from an array.
   *
   * @template T The type of elements in the array.
   * @param {readonly T[]} values - The array of values to pick from.
   * @returns {T} A randomly selected element.
   */
  pick<T>(values: readonly T[]): T {
    const index = Math.floor(this.next() * values.length);
    return values[index];
  }

  /**
   * Generates a random number following a normal (Gaussian) distribution.
   * Uses the Box-Muller transform.
   *
   * @param {number} [mean=0] - The mean of the distribution.
   * @param {number} [stdDev=1] - The standard deviation of the distribution.
   * @returns {number} A random number normally distributed around the mean.
   */
  normal(mean = 0, stdDev = 1): number {
    let u = 0;
    let v = 0;
    // Ensure non-zero inputs for Box-Muller transform
    while (u === 0) u = this.next();
    while (v === 0) v = this.next();
    const mag = Math.sqrt(-2.0 * Math.log(u));
    const z0 = mag * Math.cos(2 * Math.PI * v);
    return mean + z0 * stdDev;
  }
}
