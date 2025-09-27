export class SeededRng {
  private state = 1;

  constructor(seed: number) {
    this.reset(seed);
  }

  reset(seed: number): void {
    this.state = seed >>> 0;
    if (this.state === 0) {
      this.state = 1;
    }
  }

  next(): number {
    // Lehmer RNG with glibc parameters
    this.state = (this.state * 48271) % 0x7fffffff;
    return this.state / 0x7fffffff;
  }

  range(min: number, max: number): number {
    return min + (max - min) * this.next();
  }

  int(min: number, max: number): number {
    return Math.floor(this.range(min, max + 1));
  }

  pick<T>(values: readonly T[]): T {
    const index = Math.floor(this.next() * values.length);
    return values[index];
  }

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
