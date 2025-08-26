import { describe, it, expect } from 'vitest';
import { makeInitialState, createShip } from '../../src/entities';
import { simulateStep } from '../../src/simulate';
import { getDefaultBounds } from '../../src/config/simConfig';
import { SIM } from '../../src/config/simConfig';

// Deterministic physics test: with friction disabled (1.0) and throttle=1, ship should gain velocity = accel * dt

describe('Physics acceleration', () => {
  it('applies acceleration from throttle correctly', () => {
    const oldFriction = SIM.friction;
    try {
      SIM.friction = 1.0; // disable damping for deterministic check
  const state = makeInitialState();
  const ship = createShip('fighter', 0, 0, 'red');
  // add ship to the simulation state so simulateStep moves it
  state.ships.push(ship);
  if (!state.shipMap) state.shipMap = new Map();
  state.shipMap.set(ship.id, ship as any);
      // Ensure known angle and throttle
      ship.angle = 0; // facing +X
      ship.throttle = 1;
      // accel should come from ship cfg (fighter default 5)
      const accel = ship.accel || 0;
      const dt = 0.1; // seconds
  const bounds = getDefaultBounds();
  simulateStep(state as any, dt, bounds);
      // After one step, vx should be approx accel * dt
      const expectedVx = accel * dt;
      expect(Math.abs((ship.vx || 0) - expectedVx) < 1e-6).toBeTruthy();
    } finally {
      SIM.friction = oldFriction;
    }
  });
});
