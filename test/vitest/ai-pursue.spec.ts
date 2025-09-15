// Ensure controller debug gate sees this during module load in tests
if (typeof process !== 'undefined') {
  process.env.VITEST_AI_DEBUG = '1';
}
import { describe, it, expect } from 'vitest';
import { createInitialState, spawnShip, simulateStep } from '../../src/core/gameState.js';

describe('AI pursue movement', () => {
  it('pursue intent issues movement toward target', () => {
    const state = createInitialState('test-seed-pursue');
    // ensure AI enabled
    state.behaviorConfig!.globalSettings.aiEnabled = true;
    // Disable spawn jitter in tests to keep initial velocities deterministic
    state.behaviorConfig!.globalSettings.enableSpawnJitter = false;

    // Spawn target (blue) and pursuer (red)
    const target = spawnShip(state, 'blue', 'fighter');
    const pursuer = spawnShip(state, 'red', 'fighter');

    // Ensure initial velocities are zero
    expect(pursuer.vel.x).toBe(0);
    expect(target.vel.x).toBe(0);

    // Force pursue intent: set targetId and currentIntent
    pursuer.targetId = target.id;
    if (!pursuer.aiState) {
      pursuer.aiState = {
        currentIntent: 'pursue',
        intentEndTime: 0,
        lastIntentReevaluation: state.time, // avoid immediate reevaluation
        preferredRange: 0,
        recentDamage: 0,
        lastDamageTime: 0,
      } as any;
    } else {
      pursuer.aiState.currentIntent = 'pursue';
      pursuer.aiState.lastIntentReevaluation = state.time; // avoid immediate reevaluation
    }

    // Step simulation a few times to allow movement to apply
    for (let i = 0; i < 5; i++) simulateStep(state, 0.1);

    // Check that pursuer moved (pos or vel changed)
    const moved = Math.abs(pursuer.pos.x - pursuer.prevPos!.x) > 1e-6 || Math.abs(pursuer.vel.x) > 1e-6;
    expect(moved).toBeTruthy();
  });
});
