import type { GameState, DeferredMutation } from '../types/index.js';

export function enqueueDeferredMutation(state: GameState, op: DeferredMutation): void {
  if (typeof op !== 'function') return;
  state.simulation.deferredMutations.push(op);
}

export function enqueuePostPhysicsMutation(state: GameState, op: DeferredMutation): void {
  if (typeof op !== 'function') return;
  state.simulation.postStepMutations.push(op);
}

function recordDeferredFailure(state: GameState, error: unknown): void {
  const diag = state.simulation.rapierDiagnostics;
  diag.deferredMutationFailures += 1;
  diag.lastFailureTick = state.simulation.lastTickIndex;
  diag.lastDeferredMutationError = error instanceof Error ? error.message : String(error);
}

export function recordRapierGuardTrip(state: GameState, reason?: unknown): void {
  const diag = state.simulation.rapierDiagnostics;
  diag.guardTrips += 1;
  diag.lastGuardTick = state.simulation.lastTickIndex;
  if (reason instanceof Error && !diag.lastDeferredMutationError) {
    diag.lastDeferredMutationError = reason.message;
  }
}

function flushQueue(state: GameState, queue: DeferredMutation[], tag: 'pre' | 'post'): void {
  if (queue.length === 0) return;

  const pending = queue.slice();
  queue.length = 0;

  for (const op of pending) {
    try {
      op();
    } catch (error) {
      console.warn(`[TASK230] ${tag}-physics deferred mutation failed`, error);
      recordDeferredFailure(state, error);
    }
  }
}

export function flushDeferredMutations(state: GameState): void {
  flushQueue(state, state.simulation.deferredMutations, 'pre');
}

export function flushPostPhysicsMutations(state: GameState): void {
  flushQueue(state, state.simulation.postStepMutations, 'post');
}
