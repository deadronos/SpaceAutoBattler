import { describe, expect, it, vi } from 'vitest';
import { createTestGameState } from './helpers/fixtures.js';
import { flushDeferredMutations } from '../../src/game/simulationQueue.js';
import { deferSetNextKinematicTranslation, deferSetNextKinematicRotation } from '../../src/game/physics/safeKinematics.js';

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
    expect(state.simulation.rapierDiagnostics.guardTrips + state.simulation.rapierDiagnostics.deferredMutationFailures).toBeGreaterThan(0);
  });
});

describe('deferred kinematic rotation', () => {
  it('enqueues and the queued operation invokes the underlying setter on flush', () => {
    const state = createTestGameState();
    const setter = vi.fn();
    const body = { setNextKinematicTranslation: () => {}, setNextKinematicRotation: setter } as unknown as any;

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
    const body = { setNextKinematicTranslation: () => {}, setNextKinematicRotation: setter } as unknown as any;

    deferSetNextKinematicRotation(state, body, 4, 5, 6, 1);
    expect(state.simulation.deferredMutations).toHaveLength(1);

    // flush should not throw even if the underlying setter throws
    expect(() => flushDeferredMutations(state)).not.toThrow();
    // diagnostics should reflect a guard/trip being recorded
    expect(state.simulation.rapierDiagnostics.guardTrips + state.simulation.rapierDiagnostics.deferredMutationFailures).toBeGreaterThan(0);
  });
});
