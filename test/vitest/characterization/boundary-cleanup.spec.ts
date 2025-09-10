import { describe, it, expect } from 'vitest';
import { createInitialState, spawnShip, simulateStep } from '../../../src/core/gameState.js';

/**
 * Characterization test: boundary cleanup teleports ships back in-bounds and zeroes velocity.
 * We rely on simulateStep triggering runBoundaryCleanup based on tick modulo the interval.
 */
describe('Characterization: boundary cleanup', () => {
  it('teleports out-of-bounds ship to team center and resets velocity', () => {
    const seed = 'BOUNDARY-SEED';
    const state = createInitialState(seed);
    // Ensure cleanup is enabled with a small interval to trigger quickly
    state.behaviorConfig.globalSettings.enableBoundaryCleanup = true;
    state.behaviorConfig.globalSettings.boundaryCleanupIntervalTicks = 1; // run every tick
    // Disable AI to avoid movement interfering with test
    state.behaviorConfig.globalSettings.aiEnabled = false;

    const ship = spawnShip(state, 'red', 'fighter');
    // Place ship clearly out of bounds
    ship.pos.x = -1000;
    ship.pos.y = -1000;
    ship.pos.z = -1000;
    ship.vel.x = 10;
    ship.vel.y = 10;
    ship.vel.z = 10;

    // One tick should trigger cleanup
    simulateStep(state, 1 / 60);

    const { width, height, depth } = state.simConfig.simBounds;
    expect(ship.pos.x).toBeGreaterThanOrEqual(0);
    expect(ship.pos.y).toBeGreaterThanOrEqual(0);
    expect(ship.pos.z).toBeGreaterThanOrEqual(0);
    expect(ship.pos.x).toBeLessThanOrEqual(width);
    expect(ship.pos.y).toBeLessThanOrEqual(height);
    expect(ship.pos.z).toBeLessThanOrEqual(depth);

    // Velocity should be reset to zero by cleanup
    expect(ship.vel.x).toBe(0);
    expect(ship.vel.y).toBe(0);
    expect(ship.vel.z).toBe(0);
  });
});
