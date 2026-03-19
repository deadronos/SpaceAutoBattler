import { describe, expect, it, vi } from 'vite-plus/test';
import { createTestGameState } from './helpers/fixtures.js';
import {
  flushDeferredMutations,
  flushPostPhysicsMutations,
} from '../../src/game/simulationQueue.js';
import {
  deferSetNextKinematicTranslation,
  deferSetNextKinematicRotation,
  deferSetLinearDamping,
  postSetAngularDamping,
  deferSetColliderFriction,
  postSetColliderRestitution,
} from '../../src/game/physics/safeKinematics.js';

describe('deferred kinematic translation', () => {
  it('enqueues and the queued operation invokes the underlying setter on flush', () => {
    const state = createTestGameState();
    const setter = vi.fn();
    const body = { setNextKinematicTranslation: setter } as unknown as any;

    deferSetNextKinematicTranslation(state, body, 1, 2, 3);
    expect(state.simulation.deferredMutations).toHaveLength(1);

    flushDeferredMutations(state);
    expect(setter).toHaveBeenCalledTimes(1);
    expect(setter).toHaveBeenCalledWith({ x: 1, y: 2, z: 3 });
  });

  it('swallows exceptions from the underlying Rapier call and records diagnostics', () => {
    const state = createTestGameState();
    const setter = vi.fn(() => {
      throw new Error('Rapier panic');
    });
    const body = { setNextKinematicTranslation: setter } as unknown as any;

    deferSetNextKinematicTranslation(state, body, 4, 5, 6);
    expect(state.simulation.deferredMutations).toHaveLength(1);

    // flush should not throw even if the underlying setter throws
    expect(() => flushDeferredMutations(state)).not.toThrow();
    // diagnostics should reflect a guard/trip being recorded
    expect(
      state.simulation.rapierDiagnostics.guardTrips +
        state.simulation.rapierDiagnostics.deferredMutationFailures,
    ).toBeGreaterThan(0);
  });
});

describe('deferred kinematic rotation', () => {
  it('enqueues and the queued operation invokes the underlying setter on flush', () => {
    const state = createTestGameState();
    const setter = vi.fn();
    const body = {
      setNextKinematicTranslation: () => {},
      setNextKinematicRotation: setter,
    } as unknown as any;

    deferSetNextKinematicRotation(state, body, 1, 2, 3, 1);
    expect(state.simulation.deferredMutations).toHaveLength(1);

    flushDeferredMutations(state);
    expect(setter).toHaveBeenCalledTimes(1);
    expect(setter).toHaveBeenCalledWith({ x: 1, y: 2, z: 3, w: 1 });
  });

  it('swallows exceptions from the underlying Rapier call and records diagnostics', () => {
    const state = createTestGameState();
    const setter = vi.fn(() => {
      throw new Error('Rapier panic');
    });
    const body = {
      setNextKinematicTranslation: () => {},
      setNextKinematicRotation: setter,
    } as unknown as any;

    deferSetNextKinematicRotation(state, body, 4, 5, 6, 1);
    expect(state.simulation.deferredMutations).toHaveLength(1);

    // flush should not throw even if the underlying setter throws
    expect(() => flushDeferredMutations(state)).not.toThrow();
    // diagnostics should reflect a guard/trip being recorded
    expect(
      state.simulation.rapierDiagnostics.guardTrips +
        state.simulation.rapierDiagnostics.deferredMutationFailures,
    ).toBeGreaterThan(0);
  });
});

describe('deferred damping mutators', () => {
  it('enqueues linear damping and invokes underlying setter on flush (deferred)', () => {
    const state = createTestGameState();
    const setter = vi.fn();
    const body = { setLinearDamping: setter } as unknown as any;

    deferSetLinearDamping(state, body, 0.5);
    expect(state.simulation.deferredMutations).toHaveLength(1);

    flushDeferredMutations(state);
    expect(setter).toHaveBeenCalledTimes(1);
    expect(setter).toHaveBeenCalledWith(0.5);
  });

  it('enqueues angular damping and invokes underlying setter on flush (post)', () => {
    const state = createTestGameState();
    const setter = vi.fn();
    const body = { setAngularDamping: setter } as unknown as any;

    postSetAngularDamping(state, body, 0.25);
    expect(state.simulation.postStepMutations).toHaveLength(1);

    flushPostPhysicsMutations(state);
    expect(setter).toHaveBeenCalledTimes(1);
    expect(setter).toHaveBeenCalledWith(0.25);
  });

  it('swallows exceptions from damping setters and records diagnostics', () => {
    const state = createTestGameState();
    const setter = vi.fn(() => {
      throw new Error('panic');
    });
    const body = { setLinearDamping: setter } as unknown as any;

    deferSetLinearDamping(state, body, 0.9);
    expect(state.simulation.deferredMutations).toHaveLength(1);

    expect(() => flushDeferredMutations(state)).not.toThrow();
    expect(
      state.simulation.rapierDiagnostics.guardTrips +
        state.simulation.rapierDiagnostics.deferredMutationFailures,
    ).toBeGreaterThan(0);
  });
});

describe('deferred collider mutators', () => {
  it('enqueues collider friction setter and invokes underlying setter on flush', () => {
    const state = createTestGameState();
    const setter = vi.fn();
    const collider = { setFriction: setter } as unknown as any;

    deferSetColliderFriction(state, collider, 0.8);
    expect(state.simulation.deferredMutations).toHaveLength(1);

    flushDeferredMutations(state);
    expect(setter).toHaveBeenCalledTimes(1);
    expect(setter).toHaveBeenCalledWith(0.8);
  });

  it('enqueues collider restitution setter and invokes underlying setter on flush (post)', () => {
    const state = createTestGameState();
    const setter = vi.fn();
    const collider = { setRestitution: setter } as unknown as any;

    postSetColliderRestitution(state, collider, 0.3);
    expect(state.simulation.postStepMutations).toHaveLength(1);

    flushPostPhysicsMutations(state);
    expect(setter).toHaveBeenCalledTimes(1);
    expect(setter).toHaveBeenCalledWith(0.3);
  });

  it('swallows exceptions from collider setters and records diagnostics', () => {
    const state = createTestGameState();
    const setter = vi.fn(() => {
      throw new Error('panic');
    });
    const collider = { setFriction: setter } as unknown as any;

    deferSetColliderFriction(state, collider, 0.1);
    expect(state.simulation.deferredMutations).toHaveLength(1);

    expect(() => flushDeferredMutations(state)).not.toThrow();
    expect(
      state.simulation.rapierDiagnostics.guardTrips +
        state.simulation.rapierDiagnostics.deferredMutationFailures,
    ).toBeGreaterThan(0);
  });
});
