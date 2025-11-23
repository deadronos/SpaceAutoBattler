import { describe, it, expect } from 'vitest';
import { XP_CONFIG } from '../../src/config/progression.js';

describe('Progression Configuration', () => {
  it('should have a damage XP multiplier of 0.5', () => {
    expect(XP_CONFIG.damageXpMultiplier).toBe(0.5);
  });

  it('should calculate expected XP for 10 damage as 5 XP', () => {
    const damage = 10;
    const expectedXp = damage * XP_CONFIG.damageXpMultiplier;
    // We expect the multiplier to be 0.5, so 10 * 0.5 = 5
    expect(expectedXp).toBe(5);
  });
});
