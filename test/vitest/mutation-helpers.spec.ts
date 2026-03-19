import { describe, expect, it, vi } from 'vite-plus/test';
import { createTestGameState } from './helpers/fixtures.js';
import { withDeferredEnqueue, withPostEnqueue } from '../../src/game/physics/mutationHelpers.js';
import * as simulationQueue from '../../src/game/simulationQueue.js';

describe('mutationHelpers', () => {
  it('throws when deferred queue is missing', () => {
    expect(() => withDeferredEnqueue(null, 'deferSetMass', () => {})).toThrowError(
      'deferSetMass requires state.simulation to be initialized; call createTestGameState or provide a SimulationClock on state.simulation',
    );

    const state = createTestGameState();
    (state.simulation.deferredMutations as unknown) = undefined;

    expect(() => withDeferredEnqueue(state, 'deferSetMass', () => {})).toThrowError(
      'deferSetMass requires state.simulation to be initialized; call createTestGameState or provide a SimulationClock on state.simulation',
    );
  });

  it('records guard trips when deferred task throws', () => {
    const state = createTestGameState();
    const guardSpy = vi.spyOn(simulationQueue, 'recordRapierGuardTrip');
    const task = vi.fn(() => {
      throw new Error('panic');
    });

    withDeferredEnqueue(state, 'deferSetMass', task);
    expect(state.simulation.deferredMutations).toHaveLength(1);

    const queued = state.simulation.deferredMutations[0];
    expect(queued).toBeTypeOf('function');
    expect(() => queued?.()).not.toThrow();

    expect(task).toHaveBeenCalledTimes(1);
    expect(guardSpy).toHaveBeenCalledWith(state, expect.any(Error));

    guardSpy.mockRestore();
  });

  it('throws when post queue is missing', () => {
    expect(() => withPostEnqueue(null, 'postSetMass', () => {})).toThrowError(
      'postSetMass requires state.simulation to be initialized; call createTestGameState or provide a SimulationClock on state.simulation',
    );

    const state = createTestGameState();
    (state.simulation.postStepMutations as unknown) = undefined;

    expect(() => withPostEnqueue(state, 'postSetMass', () => {})).toThrowError(
      'postSetMass requires state.simulation to be initialized; call createTestGameState or provide a SimulationClock on state.simulation',
    );
  });

  it('records guard trips when post task throws', () => {
    const state = createTestGameState();
    const guardSpy = vi.spyOn(simulationQueue, 'recordRapierGuardTrip');
    const task = vi.fn(() => {
      throw new Error('panic');
    });

    withPostEnqueue(state, 'postSetMass', task);
    expect(state.simulation.postStepMutations).toHaveLength(1);

    const queued = state.simulation.postStepMutations[0];
    expect(queued).toBeTypeOf('function');
    expect(() => queued?.()).not.toThrow();

    expect(task).toHaveBeenCalledTimes(1);
    expect(guardSpy).toHaveBeenCalledWith(state, expect.any(Error));

    guardSpy.mockRestore();
  });
});
