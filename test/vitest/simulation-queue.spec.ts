import { describe, expect, it, vi } from 'vitest';
import { enqueueDeferredMutation, flushDeferredMutations } from '../../src/game/simulationQueue.js';
import { createTestGameState } from './helpers/fixtures.js';

describe('simulation queue', () => {
  it('executes queued operations once in insertion order and clears queue', () => {
    const state = createTestGameState();
    state.simulation.deferredMutations.length = 0;

    const order: number[] = [];
    enqueueDeferredMutation(state, () => order.push(1));
    enqueueDeferredMutation(state, () => order.push(2));

  flushDeferredMutations(state);
  flushDeferredMutations(state);

  expect(order).toEqual([1, 2]);
  expect(state.simulation.deferredMutations).toHaveLength(0);
  });

  it('defers newly enqueued operations until the next flush', () => {
    const state = createTestGameState();
    state.simulation.deferredMutations.length = 0;

    const order: string[] = [];
    enqueueDeferredMutation(state, () => {
      order.push('first');
      enqueueDeferredMutation(state, () => order.push('second'));
    });

    flushDeferredMutations(state);
    expect(order).toEqual(['first']);
    expect(state.simulation.deferredMutations).toHaveLength(1);

    flushDeferredMutations(state);
    expect(order).toEqual(['first', 'second']);
    expect(state.simulation.deferredMutations).toHaveLength(0);
  });

  it('swallows errors from deferred operations without propagating', () => {
    const state = createTestGameState();
    state.simulation.deferredMutations.length = 0;

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const faulty = vi.fn(() => {
      throw new Error('mutation failed');
    });

    enqueueDeferredMutation(state, faulty);

    expect(() => flushDeferredMutations(state)).not.toThrow();
    expect(faulty).toHaveBeenCalledTimes(1);
    expect(state.simulation.deferredMutations).toHaveLength(0);

    warnSpy.mockRestore();
  });
});
