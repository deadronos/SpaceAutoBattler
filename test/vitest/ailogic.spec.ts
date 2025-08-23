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
