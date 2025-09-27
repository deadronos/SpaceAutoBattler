import { SeededRng } from './rng.js';

const GOLDEN = 0x9e3779b9;

export function smoothingFactorFromSeed(seed: number): number {
  const rng = new SeededRng((seed ^ GOLDEN) >>> 0);
  // Bias towards faster easing while keeping deterministic variance per ship.
  return 0.35 + rng.next() * 0.35;
}

export function lerpBySeed(seed: number, previous: number, target: number): number {
  if (!Number.isFinite(previous) || !Number.isFinite(target)) {
    return target;
  }
  const factor = smoothingFactorFromSeed(seed);
  return previous + (target - previous) * factor;
}
