import { describe, test, expect } from 'vitest';
import { createInitialState, spawnShip } from '../../src/core/gameState.js';
import { AIController } from '../../src/core/aiController.js';

describe('AI Separation Helper', () => {
  test('returns zero force and zero neighbors when no friends nearby', () => {
    const state = createInitialState();
    // Clear any default ships
    state.ships = [];

    const ship = spawnShip(state, 'red', 'fighter', { x: 100, y: 100, z: 100 });
    const controller = new AIController(state) as any;

    const res = controller.calculateSeparationForceWithCount(ship);

    expect(res.neighborCount).toBe(0);
    expect(res.force).toEqual({ x: 0, y: 0, z: 0 });
  });

  test('detects a single neighbor and force points away from it', () => {
    const state = createInitialState();
    state.ships = [];

    const separationDistance = state.behaviorConfig!.globalSettings.separationDistance;

    // Place ship1 at x and ship2 to the right within separationDistance
    const ship1 = spawnShip(state, 'red', 'fighter', { x: 200, y: 200, z: 200 });
    const ship2 = spawnShip(state, 'red', 'fighter', { x: 200 + separationDistance / 2, y: 200, z: 200 });

    const controller = new AIController(state) as any;
    const res = controller.calculateSeparationForceWithCount(ship1);

    expect(res.neighborCount).toBe(1);
    // Since the neighbor is to the +X side, force.x should be negative (away)
    expect(res.force.x).toBeLessThan(0);
    expect(Math.hypot(res.force.x, res.force.y, res.force.z)).toBeGreaterThan(0);
  });

  test('counts multiple neighbors and returns non-zero normalized force', () => {
    const state = createInitialState();
    state.ships = [];

    const separationDistance = state.behaviorConfig!.globalSettings.separationDistance;

    const center = { x: 400, y: 400, z: 200 };
    const ship = spawnShip(state, 'red', 'frigate', center);

    // Place several friends around within separationDistance
    spawnShip(state, 'red', 'frigate', { x: center.x + separationDistance * 0.4, y: center.y + 10, z: center.z });
    spawnShip(state, 'red', 'frigate', { x: center.x - separationDistance * 0.3, y: center.y - 5, z: center.z });
    spawnShip(state, 'red', 'frigate', { x: center.x + 5, y: center.y + separationDistance * 0.45, z: center.z });

    const controller = new AIController(state) as any;
    const res = controller.calculateSeparationForceWithCount(ship);

    expect(res.neighborCount).toBeGreaterThanOrEqual(3);
    // Force should be normalized (or at least non-zero)
    const mag = Math.hypot(res.force.x, res.force.y, res.force.z);
    expect(mag).toBeGreaterThan(0);
    // Each component should be finite and defined
    expect(Number.isFinite(res.force.x)).toBe(true);
    expect(Number.isFinite(res.force.y)).toBe(true);
    expect(Number.isFinite(res.force.z)).toBe(true);
  });
});
