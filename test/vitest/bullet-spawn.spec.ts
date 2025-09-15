import { describe, it, expect } from 'vitest';
import { createInitialState, spawnShip, simulateStep } from '../../src/core/gameState';
import { DEFAULT_BEHAVIOR_CONFIG } from '../../src/config/behaviorConfig';

describe('Projectile spawn integration', () => {
  it('should produce bullets when attacker has a target', () => {
    const state = createInitialState('vitest-fire');
    state.behaviorConfig = { ...DEFAULT_BEHAVIOR_CONFIG };
    const attacker = spawnShip(state, 'red', 'frigate', { x: 100, y: 100, z: 100 });
    const target = spawnShip(state, 'blue', 'fighter', { x: 300, y: 100, z: 100 });
    state.time = 10;

    // Run a few steps to let AI and cooldowns process
    for (let i = 0; i < 10; i++) {
      simulateStep(state, 1 / 60);
    }

    // Debug output when failing
    if (state.bullets.length === 0) {
      // Log turret states for debugging
      for (const ship of state.ships) {
         
        console.log(`Ship ${ship.id} team=${ship.team}`);
        for (const t of ship.turrets) {
           
          console.log(
            `  turret ${t.id} cooldownLeft=${t.cooldownLeft} aiTarget=${t.aiState?.targetId}`,
          );
        }
      }
    }

    expect(state.bullets.length).toBeGreaterThan(0);
  });
});
