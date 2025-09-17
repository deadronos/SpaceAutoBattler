import { describe, it, expect } from 'vitest';
import { createInitialState, spawnShip, simulateStep } from '../../src/core/gameState.js';

// TASK-014: Verify prev-state capture runs before mutations in a step.
// TASK-015: Verify spawn initialization sets prev == current (pos and orientation for ships).

describe('Prev-state capture and spawn initialization', () => {
  it('captures previous bullet position before movement (prev before mutation)', () => {
    const state = createInitialState('prev-capture-test');

    // Create a simple moving bullet (no renderer)
    state.bullets.push({
      id: 42,
      ownerShipId: 1,
      ownerTeam: 'red',
      pos: { x: 10, y: 0, z: 0 },
      prevPos: { x: 10, y: 0, z: 0 },
      vel: { x: 100, y: 0, z: 0 },
      ttl: 5,
      damage: 1,
    });

    // Store current position before simulateStep
    const beforePosX = state.bullets[0].pos.x;

    // Advance one simulation step
    const dt = 1 / (state.simConfig?.tickRate ?? 60);
    simulateStep(state, dt);

    // After the step:
    // - prevPos should equal the value from before the step
    // - pos should have advanced forward along x
    const b = state.bullets[0];
    expect(b.prevPos.x).toBe(beforePosX);
    expect(b.pos.x).toBeGreaterThan(beforePosX);
  });

  it('initializes ship prevPos and prevOrientation equal to current on spawn', () => {
    const state = createInitialState('spawn-init-test');

    // Spawn at a specific pose
    const pos = { x: 123, y: 456, z: 78 };
    const ship = spawnShip(state, 'blue', 'fighter', pos);

    // Expectations: prevPos equals pos on first frame
    expect(ship.prevPos).toEqual(ship.pos);

    // Orientation fields exist and prevOrientation equals orientation on spawn
    expect(ship.prevOrientation).toEqual(ship.orientation);
  });
});
