import type { GameState, DeferredMutation } from '../types/index.js';

export function enqueueDeferredMutation(state: GameState, op: DeferredMutation): void {
  if (typeof op !== 'function') return;
  state.simulation.deferredMutations.push(op);
}

export function flushDeferredMutations(state: GameState): void {
  const queue = state.simulation.deferredMutations;
  if (queue.length === 0) return;

  const pending = queue.slice();
  queue.length = 0;

  for (const op of pending) {
    try {
      op();
    } catch (error) {
      console.warn('[TASK230] deferred mutation failed', error);
    }
  }
}
