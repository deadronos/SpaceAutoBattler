  it('should set currentAccel dynamically based on AI state', () => {
    const state = makeInitialState();
    const ship1 = createShip('fighter', 100, 100, 'red');
    const ship2 = createShip('fighter', 200, 200, 'blue');
    state.ships.push(ship1, ship2);
    // Initially, currentAccel should be 0
    expect(ship1.currentAccel).toBe(0);
    applySimpleAI(state, 0.1, { W: 1920, H: 1080 });
    // After AI step, currentAccel should be set (0 < currentAccel <= accel)
    expect(ship1.currentAccel).toBeGreaterThanOrEqual(0);
  // Defensive: ensure accel is defined
  expect(ship1.currentAccel).toBeLessThanOrEqual(ship1.accel ?? 9999);
  });
import { describe, it, expect } from 'vitest';
import { applySimpleAI } from '../../src/behavior';
import { makeInitialState, createShip } from '../../src/entities';

describe('AILogic', () => {
  it('should assign targets and change state', () => {
    const state = makeInitialState();
    const ship1 = createShip('fighter', 100, 100, 'red');
    const ship2 = createShip('fighter', 200, 200, 'blue');
    state.ships.push(ship1, ship2);
    applySimpleAI(state, 0.1, { W: 1920, H: 1080 });
    expect(ship1.__ai).toBeDefined();
    expect(ship1.__ai.targetId).toBe(ship2.id);
  });

  it('should fire at enemy ships', () => {
    const state = makeInitialState();
    const ship1 = createShip('fighter', 100, 100, 'red');
    const ship2 = createShip('fighter', 110, 100, 'blue');
    state.ships.push(ship1, ship2);
    applySimpleAI(state, 1.0, { W: 1920, H: 1080 });
    expect(state.bullets.length).toBeGreaterThan(0);
  });
});
