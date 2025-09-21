export class SeededRng {
  private state: number;

  constructor(seed: number) {
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
}
