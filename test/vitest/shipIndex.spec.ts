import { describe, it, expect } from 'vitest';
import { createInitialState, spawnShip, simulateStep } from '../../src/core/gameState.js';
import type { GameState } from '../../src/types/index.js';

describe('shipIndex cache', () => {
  it('populates on spawn and rebuilds on removal', () => {
    const state = createInitialState('shipindex-seed');
    const s1 = spawnShip(state, 'red', 'fighter');
    const s2 = spawnShip(state, 'blue', 'fighter');

    // shipIndex should contain both
    expect(state.shipIndex).toBeDefined();
    expect(state.shipIndex!.get(s1.id)).toBeDefined();
    expect(state.shipIndex!.get(s2.id)).toBeDefined();

    // Kill s2 and run a step to process removal
    s2.health = 0;
    // advance time a bit and run simulateStep to trigger removal
    state.time += 1;
    simulateStep(state, 0.016);

    // After simulateStep, s2 should be removed and shipIndex rebuilt
    expect(state.shipIndex!.has(s2.id)).toBe(false);
    expect(state.shipIndex!.has(s1.id)).toBe(true);
  });
});
