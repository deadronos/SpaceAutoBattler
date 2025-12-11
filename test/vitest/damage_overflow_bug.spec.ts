import { describe, expect, it } from 'vitest';
import { calculateEffectiveDamage } from '../../src/game/combat/damage.js';

describe('calculateEffectiveDamage overflow bug', () => {
  it('should not amplify damage when breaking a weak shield with high-effectiveness weapon', () => {
    // Ion damage: 1.4x vs shield, 0.7x vs hull.
    // We compare damage to a naked hull vs a hull with a tiny shield.

    const damage = 100;
    const damageType = 'ion';
    const nakedHullResult = calculateEffectiveDamage(damage, damageType, 0, 0);
    const shieldedHullResult = calculateEffectiveDamage(damage, damageType, 1, 0);

    // Naked hull: 100 * 0.7 = 70.
    // Shielded hull (buggy): (140 - 1) * 0.7 = 97.3.
    // Shielded hull (expected): (100 - (1/1.4)) * 0.7 ~= 69.5.

    // The shielded result should be strictly less than the naked result (shield absorbed some damage).
    expect(shieldedHullResult.hullDamage).toBeLessThan(nakedHullResult.hullDamage);

    // Explicitly check for the correct value to prevent regression
    expect(shieldedHullResult.hullDamage).toBeCloseTo(69.5, 1);
  });
});
