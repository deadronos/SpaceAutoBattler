import { expect, test } from 'vitest';
import { createTestGameState } from './helpers/fixtures.js';
import {
  flushDeferredMutations,
  flushPostPhysicsMutations,
} from '../../src/game/simulationQueue.js';
import {
  deferSetNextKinematicTranslation,
  postSetNextKinematicTranslation,
  deferSetLinvel,
  postSetLinvel,
} from '../../src/game/physics/safeKinematics.js';

// Helper to simulate a minimal physics step for tests. It reads rigidBody.linvel
// and advances the translation by velocity * dt using the same setter API that
// production systems use (setNextKinematicTranslation).
function simulatePhysicsStep(state: any, dt: number) {
  const ships = state.queries.ships.entities;
  for (const ship of ships) {
    const rb = ship.rigidBody;
    if (!rb || typeof rb.translation !== 'function') continue;
    const pos = rb.translation();
    const vel = typeof rb.linvel === 'function' ? rb.linvel() : { x: 0, y: 0, z: 0 };
    const newPos = { x: pos.x + vel.x * dt, y: pos.y + vel.y * dt, z: pos.z + vel.z * dt };
    if (typeof rb.setNextKinematicTranslation === 'function') {
      rb.setNextKinematicTranslation(newPos);
    }
  }
}

test('deferred pre → physics → post ordering for translation affects position as expected', () => {
  const state = createTestGameState();

  // create a simple rigid body shim with observable translation & velocity
  let translation = { x: 0, y: 0, z: 0 };
  let vel = { x: 1, y: 0, z: 0 };
  const rb = {
    setNextKinematicTranslation: ({ x, y, z }: any) => {
      translation = { x, y, z };
    },
    translation: () => ({ ...translation }),
    linvel: () => ({ ...vel }),
  };

  const ship = { id: 1, rigidBody: rb };
  state.queries.ships.entities.push(ship);

  // Enqueue a pre-step translation and a post-step translation
  deferSetNextKinematicTranslation(state, rb as any, 10, 0, 0);
  postSetNextKinematicTranslation(state, rb as any, 30, 0, 0);

  // Pre flush should apply the pre-step translation
  flushDeferredMutations(state);
  expect(rb.translation().x).toBeCloseTo(10, 6);

  // Simulate physics step with dt = 1 -> translation should advance by vel (1)
  simulatePhysicsStep(state, 1);
  expect(rb.translation().x).toBeCloseTo(11, 6);

  // Post flush should overwrite to post-step translation
  flushPostPhysicsMutations(state);
  expect(rb.translation().x).toBeCloseTo(30, 6);
});

test('deferred linvel changes take effect at correct phase relative to physics', () => {
  const state = createTestGameState();

  let translation = { x: 0, y: 0, z: 0 };
  let vel = { x: 1, y: 0, z: 0 };
  const rb = {
    setNextKinematicTranslation: ({ x, y, z }: any) => {
      translation = { x, y, z };
    },
    translation: () => ({ ...translation }),
    linvel: () => ({ ...vel }),
    setLinvel: ({ x, y, z }: any) => {
      vel = { x, y, z };
    },
  };

  const ship = { id: 2, rigidBody: rb };
  state.queries.ships.entities.push(ship);

  // Pre-step: set linvel to 2 so physics step uses updated velocity
  deferSetLinvel(state, rb as any, 2, 0, 0);
  // Post-step: set linvel back to 0 after physics
  postSetLinvel(state, rb as any, 0, 0, 0);

  // Pre flush applies the linvel change
  flushDeferredMutations(state);
  expect(rb.linvel().x).toBeCloseTo(2, 6);

  // Physics step uses the updated velocity -> translation increases by 2
  simulatePhysicsStep(state, 1);
  expect(rb.translation().x).toBeCloseTo(2, 6);

  // Post flush resets the velocity to 0
  flushPostPhysicsMutations(state);
  expect(rb.linvel().x).toBeCloseTo(0, 6);
});
