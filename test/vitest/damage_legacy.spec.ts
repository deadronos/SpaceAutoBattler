import { describe, expect, it } from 'vite-plus/test';
import { calculateEffectiveDamage } from '../../src/game/combat/damage.js';

describe('calculateEffectiveDamage', () => {
  it('fully absorbs damage with shields when effectiveness keeps damage below shield value', () => {
    const result = calculateEffectiveDamage(50, 'ion', 100, 20);
    expect(result).toEqual({ shieldDamage: 70, armorDamage: 0, hullDamage: 0 });
  });

  it('splits overflow damage between armor absorption and hull', () => {
    const result = calculateEffectiveDamage(100, 'kinetic', 50, 20);
    expect(result.shieldDamage).toBe(50);
    expect(result.armorDamage).toBe(18.75);
    expect(result.hullDamage).toBe(18.75);
  });

  it('handles targets without shields by applying armor absorption and hull damage', () => {
    const result = calculateEffectiveDamage(80, 'plasma', 0, 10);
    expect(result.shieldDamage).toBe(0);
    expect(result.armorDamage).toBeCloseTo(13);
    expect(result.hullDamage).toBeCloseTo(73.7);
  });

  it('clamps negative damage inputs to zero', () => {
    const result = calculateEffectiveDamage(-25, 'explosive', 100, 50);
    expect(result).toEqual({ shieldDamage: 0, armorDamage: 0, hullDamage: 0 });
  });

  it('caps armor absorption using armor effectiveness multiplier', () => {
    const result = calculateEffectiveDamage(200, 'explosive', 0, 5);
    expect(result.armorDamage).toBeCloseTo(5.5);
    expect(result.hullDamage).toBeCloseTo((200 - 5.5) * 1.2);
  });
});
