import { SeededRng } from '../utils/rng.js';
import type { AITraits } from '../types/index.js';

const VARIANCE = 0.1; // ±10%

function sampleModifier(rng: SeededRng, variance: number): number {
  const value = rng.next() * 2 - 1; // [-1, 1)
  const modifier = 1 + value * variance;
  const min = 1 - variance;
  const max = 1 + variance;
  if (modifier < min) return min;
  if (modifier > max) return max;
  return modifier;
}

export function generateTraitsFromSeed(seed: number): AITraits {
  const normalizedSeed = seed >>> 0;
  const rng = new SeededRng(normalizedSeed === 0 ? 1 : normalizedSeed);
  return {
    aggression: sampleModifier(rng, VARIANCE),
    patience: sampleModifier(rng, VARIANCE),
    dodge: sampleModifier(rng, VARIANCE),
  };
}
