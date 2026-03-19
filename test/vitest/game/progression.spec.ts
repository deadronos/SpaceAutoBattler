import { describe, it, expect } from 'vite-plus/test';
import { XP_CONFIG } from '../../../src/config/progression.js';

describe('Progression Config', () => {
  it('should have the correct damage XP multiplier', () => {
    expect(XP_CONFIG.damageXpMultiplier).toBe(0.5);
  });

  it('should calculate expected XP correctly based on the multiplier', () => {
    const damage = 10;
    const expectedXp = damage * XP_CONFIG.damageXpMultiplier;
    // If multiplier is 0.5, 10 * 0.5 = 5
    expect(expectedXp).toBe(5);
  });
});
