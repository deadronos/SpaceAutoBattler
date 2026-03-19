import { describe, expect, it } from 'vite-plus/test';
import { generateTraitsFromSeed } from '../../src/game/aiTraits.js';

function withinRange(value: number, variance = 0.1): boolean {
  return value >= 1 - variance && value <= 1 + variance;
}

describe('generateTraitsFromSeed', () => {
  it('produces deterministic modifiers for the same seed', () => {
    const first = generateTraitsFromSeed(12345);
    const second = generateTraitsFromSeed(12345);
    expect(second).toEqual(first);
  });

  it('keeps modifiers within ±10%', () => {
    const traits = generateTraitsFromSeed(67890);
    expect(withinRange(traits.aggression)).toBe(true);
    expect(withinRange(traits.patience)).toBe(true);
    expect(withinRange(traits.dodge)).toBe(true);
  });

  it('yields variation for different seeds', () => {
    const base = generateTraitsFromSeed(1);
    const variant = generateTraitsFromSeed(2);
    expect(variant.aggression).not.toBe(base.aggression);
    expect(variant.patience).not.toBe(base.patience);
    expect(variant.dodge).not.toBe(base.dodge);
  });
});
