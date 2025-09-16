import { describe, it, expect } from 'vitest';
import { createInitialState, spawnShip } from '../../src/core/gameState.js';
import { TURRET_CONFIGS } from '../../src/config/entitiesConfig.js';
import type { TurretConfig } from '../../src/types/index.js';

describe('designer turret preferredBehavior', () => {
  it('initializes turret.aiState.behavior from preferredBehavior when set', () => {
    const state = createInitialState('test-seed-pref');
    // Temporarily clone and mutate TURRET_CONFIGS entry for this test
    const key = 'fighter-cannon';
    // Mutate the existing config object in-place so references in SHIP_CLASS_CONFIGS see the change
    const originalPref = (TURRET_CONFIGS[key] as TurretConfig).preferredBehavior;
    (TURRET_CONFIGS[key] as TurretConfig).preferredBehavior = 'lead_target';

    const ship = spawnShip(state, 'red', 'fighter');
    const t = ship.turrets[0];
    expect(t.aiState).toBeDefined();
    expect(t.aiState!.behavior).toBe('lead_target');

    // restore original preference
    if (originalPref === undefined) delete (TURRET_CONFIGS[key] as TurretConfig).preferredBehavior;
    else (TURRET_CONFIGS[key] as TurretConfig).preferredBehavior = originalPref;
  });
});
