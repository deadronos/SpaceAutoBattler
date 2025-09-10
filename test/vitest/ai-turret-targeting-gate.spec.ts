import { describe, it, expect } from 'vitest';
import { createInitialState, spawnShip, simulateStep } from '../../src/core/gameState.js';
import { DEFAULT_BEHAVIOR_CONFIG } from '../../src/config/behaviorConfig.js';

// Parity test: enabling the helper should not change target selection for a simple setup
describe('Turret targeting helper gate (parity)', () => {
  it('produces identical targetId with gate on vs off', () => {
    const setup = () => {
      const state = createInitialState('turret-gate');
      state.behaviorConfig = { ...DEFAULT_BEHAVIOR_CONFIG };
      const ship = spawnShip(state, 'red', 'frigate', { x: 0, y: 0, z: 0 });
      const e1 = spawnShip(state, 'blue', 'fighter', { x: 200, y: 0, z: 0 });
      const e2 = spawnShip(state, 'blue', 'destroyer', { x: 500, y: 0, z: 0 });
      // Ensure in-range and force reevaluation
      state.time += state.behaviorConfig.turretConfig.targetReevaluationRate + 0.05;
      for (const t of ship.turrets) {
        if (t.aiState) t.aiState.lastTargetUpdate = 0;
      }
      return { state, ship, e1, e2 };
    };

    // Legacy path
    const { state: sLegacy, ship: shipLegacy } = setup();
    sLegacy.behaviorConfig.globalSettings.useTurretTargetingHelper = false;
    simulateStep(sLegacy, 0.016);
    const legacyTarget = shipLegacy.targetId;

    // Helper path
    const { state: sHelper, ship: shipHelper } = setup();
    sHelper.behaviorConfig.globalSettings.useTurretTargetingHelper = true;
    simulateStep(sHelper, 0.016);
    const helperTarget = shipHelper.targetId;

    expect(helperTarget).toBe(legacyTarget);
  });
});
