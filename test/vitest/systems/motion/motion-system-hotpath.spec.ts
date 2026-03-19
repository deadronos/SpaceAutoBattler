import { describe, it, expect } from 'vite-plus/test';
import { Vector3 } from 'three';
import { updateMotionSystem } from '../../../../src/game/systems/motion/index.js';
import { createTestGameState, createTestShip } from '../../helpers/fixtures.js';

describe('motion system hot path tuning', () => {
  it('iterates only commanded ships when shipsWithCommands query is present', () => {
    const state = createTestGameState();
    const commanded = createTestShip(1, 'blue', new Vector3());
    const idle = createTestShip(2, 'red', new Vector3());

    // Only the commanded ship lives in the narrowed query.
    state.queries.ships.entities.push(commanded, idle);
    state.queries.shipsWithCommands.entities = [commanded];

    // Give commanded ship thrust so we can observe velocity change.
    commanded.ai!.command.thrust = 1;

    updateMotionSystem(state, 0.1);

    expect(commanded.ship.velocity.length()).toBeGreaterThan(0);
    expect(idle.ship.velocity.length()).toBe(0);
    // One commanded ship triggers two deferred mutations (translation + rotation sync).
    expect(state.simulation.deferredMutations.length).toBe(2);
  });

  it('early-outs idle commands and avoids physics enqueue', () => {
    const state = createTestGameState();
    const ship = createTestShip(3, 'blue', new Vector3());
    ship.ai!.command.heading.set(0, 0, 1);
    ship.ai!.command.thrust = 0;
    ship.ai!.command.strafe = 0;

    state.queries.ships.entities.push(ship);
    state.queries.shipsWithCommands.entities = [ship];

    updateMotionSystem(state, 0.1);

    expect(state.simulation.deferredMutations.length).toBe(0);
    expect(ship.ship.velocity.length()).toBe(0);
    expect(ship.ship.angularVelocity.length()).toBe(0);
  });
});
