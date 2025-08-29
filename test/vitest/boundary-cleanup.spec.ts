import { describe, test, expect } from 'vitest';
import { createInitialState, spawnShip, simulateStep } from '../../src/core/gameState.js';

describe('Boundary cleanup', () => {
  test('teleports out-of-bounds ship back inside and zeroes velocity', () => {
    const state = createInitialState();
    // Ensure cleanup is enabled and interval is short for test
    state.behaviorConfig!.globalSettings.enableBoundaryCleanup = true;
    state.behaviorConfig!.globalSettings.boundaryCleanupIntervalTicks = 2; // run quickly

    // Create a ship intentionally out of bounds
    const ship = spawnShip(state, 'red', 'fighter', { x: -5000, y: -5000, z: -5000 });
    // Sanity: ship starts outside
    expect(ship.pos.x).toBeLessThan(0);

    // Advance ticks until cleanup runs (simulateStep doesn't increment tick; we emulate ticks manually)
    // simulateStep uses state.tick to decide when to run cleanup, so increment tick manually
    state.tick = 1;
    simulateStep(state, 1/60);
    // After first step (tick=1), cleanup interval 2 not yet hit
    expect(ship.pos.x).toBeLessThan(0);

    // Next tick should trigger cleanup
    state.tick = 2;
    simulateStep(state, 1/60);

    // After cleanup, ship should be within bounds and velocity zero
    const bounds = state.simConfig.simBounds;
    expect(ship.pos.x).toBeGreaterThanOrEqual(0);
    expect(ship.pos.x).toBeLessThanOrEqual(bounds.width);
    expect(ship.pos.y).toBeGreaterThanOrEqual(0);
    expect(ship.pos.y).toBeLessThanOrEqual(bounds.height);
    expect(ship.pos.z).toBeGreaterThanOrEqual(0);
    expect(ship.pos.z).toBeLessThanOrEqual(bounds.depth);
    expect(ship.vel.x).toBe(0);
    expect(ship.vel.y).toBe(0);
    expect(ship.vel.z).toBe(0);
  });

  test('prunes bullets that are out of bounds during cleanup', () => {
    const state = createInitialState();
    state.behaviorConfig!.globalSettings.enableBoundaryCleanup = true;
    state.behaviorConfig!.globalSettings.boundaryCleanupIntervalTicks = 2;

    // Add an out-of-bounds bullet object to state.bullets
    state.bullets.push({ id: 9999, ownerShipId: 0, ownerTeam: 'red', pos: { x: -9999, y: 0, z: 0 }, vel: { x: 0, y: 0, z: 0 }, ttl: 10, damage: 1 });
    expect(state.bullets.length).toBeGreaterThan(0);

    state.tick = 2;
    simulateStep(state, 1/60);

    // Bullet should be pruned
    expect(state.bullets.find(b => b.id === 9999)).toBeUndefined();
  });
});
