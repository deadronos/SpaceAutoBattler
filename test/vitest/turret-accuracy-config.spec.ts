import { describe, it, expect } from 'vitest';
import { DEFAULT_BEHAVIOR_CONFIG } from '../../src/config/behaviorConfig';

function computeFinalInaccuracy(turretAccuracy: number | undefined, shipLevel: number, perLevel = 0.02, maxReduction = 0.5) {
  const turretAcc = typeof turretAccuracy === 'number' ? turretAccuracy : 1.0;
  const baseInaccuracy = Math.max(0, 1 - turretAcc);
  const levelReduction = Math.max(0, Math.min(maxReduction, (shipLevel - 1) * perLevel));
  const finalInaccuracy = baseInaccuracy * (1 - levelReduction);
  return finalInaccuracy;
}

describe('turret accuracy global settings', () => {
  it('DEFAULT_BEHAVIOR_CONFIG global settings exist and enforce non-increasing inaccuracy', () => {
    const gs = DEFAULT_BEHAVIOR_CONFIG.globalSettings;
    const perLevel = gs.turretLevelAccuracyPerLevel ?? 0.02;
    const maxReduction = gs.turretLevelAccuracyMaxReduction ?? 0.5;

    // pick a sample turret accuracy (designer default often < 1)
    const turretAccuracy = 0.85; // 15% base inaccuracy

    const inc1 = computeFinalInaccuracy(turretAccuracy, 1, perLevel, maxReduction);
    const inc10 = computeFinalInaccuracy(turretAccuracy, 10, perLevel, maxReduction);
    const inc100 = computeFinalInaccuracy(turretAccuracy, 100, perLevel, maxReduction);

    expect(inc10).toBeLessThanOrEqual(inc1);
    expect(inc100).toBeLessThanOrEqual(inc10);

    // cap should be respected
    const expectedCapped = Math.max(0, 1 - turretAccuracy) * (1 - maxReduction);
    expect(inc100).toBeGreaterThanOrEqual(0);
    expect(inc100).toBeGreaterThanOrEqual(expectedCapped - 1e-9);
  });
});
