import { describe, it, expect } from 'vitest';

// We'll reimplement the finalInaccuracy calculation from ProjectileSystem.fire in a pure function
function computeFinalInaccuracy(turretAccuracy: number | undefined, shipLevel: number, perLevel = 0.02, maxReduction = 0.5) {
  const turretAcc = typeof turretAccuracy === 'number' ? turretAccuracy : 1.0;
  const baseInaccuracy = Math.max(0, 1 - turretAcc);
  const levelReduction = Math.max(0, Math.min(maxReduction, (shipLevel - 1) * perLevel));
  const finalInaccuracy = baseInaccuracy * (1 - levelReduction);
  return finalInaccuracy;
}

describe('turret accuracy leveling', () => {
  it('reduces finalInaccuracy as ship level increases', () => {
    const turretAccuracy = 0.9; // 10% base inaccuracy
    const perLevel = 0.02;
    const maxReduction = 0.5;

    const incAt1 = computeFinalInaccuracy(turretAccuracy, 1, perLevel, maxReduction);
    const incAt5 = computeFinalInaccuracy(turretAccuracy, 5, perLevel, maxReduction);
    const incAt20 = computeFinalInaccuracy(turretAccuracy, 20, perLevel, maxReduction);

    // sanity: base inaccuracy should be > 0
    expect(incAt1).toBeGreaterThan(0);
    // higher levels should reduce inaccuracy (non-increasing sequence)
    expect(incAt5).toBeLessThanOrEqual(incAt1);
    expect(incAt20).toBeLessThanOrEqual(incAt5);
    // at very high level should not go negative
    expect(incAt20).toBeGreaterThanOrEqual(0);
  });

  it('caps level reduction at maxReduction', () => {
    const turretAccuracy = 0.6; // 40% base inaccuracy
    const perLevel = 0.1; // big per-level to hit cap quickly
    const maxReduction = 0.25; // 25% max

    const incAt1 = computeFinalInaccuracy(turretAccuracy, 1, perLevel, maxReduction);
    const incAt100 = computeFinalInaccuracy(turretAccuracy, 100, perLevel, maxReduction);

    // expected levelReduction at level 100 would be capped at 0.25
    const expected = Math.max(0, 1 - turretAccuracy) * (1 - maxReduction);
    expect(incAt100).toBeCloseTo(expected, 8);
    expect(incAt100).toBeLessThanOrEqual(incAt1);
  });
});
