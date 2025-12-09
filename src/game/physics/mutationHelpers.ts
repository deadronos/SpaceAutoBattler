import type { GameState } from '../../types/index.js';
import {
  enqueueDeferredMutation,
  enqueuePostPhysicsMutation,
  recordRapierGuardTrip,
} from '../simulationQueue.js';

/**
 * A task that performs a mutation on the physics world or game state.
 */
export type MutationTask = () => void;

type SimulationQueueKey = 'deferredMutations' | 'postStepMutations';

function requireSimulationQueue(
  state: GameState | null | undefined,
  queue: SimulationQueueKey,
  caller: string,
): GameState {
  if (!state || !state.simulation || !Array.isArray(state.simulation[queue])) {
    throw new Error(
      `${caller} requires state.simulation to be initialized; call createTestGameState or provide a SimulationClock on state.simulation`,
    );
  }
  return state;
}

function wrapMutation(state: GameState, task: MutationTask): () => void {
  return () => {
    try {
      task();
    } catch (error) {
      recordRapierGuardTrip(state, error);
    }
  };
}

/**
 * Enqueues a task to be executed before the physics step (deferred).
 *
 * @param {GameState | null | undefined} state - The game state.
 * @param {string} caller - The name of the calling function (for error reporting).
 * @param {MutationTask} task - The mutation to perform.
 */
export function withDeferredEnqueue(
  state: GameState | null | undefined,
  caller: string,
  task: MutationTask,
): void {
  const gameState = requireSimulationQueue(state, 'deferredMutations', caller);
  enqueueDeferredMutation(gameState, wrapMutation(gameState, task));
}

/**
 * Enqueues a task to be executed after the physics step (post-step).
 *
 * @param {GameState | null | undefined} state - The game state.
 * @param {string} caller - The name of the calling function.
 * @param {MutationTask} task - The mutation to perform.
 */
export function withPostEnqueue(
  state: GameState | null | undefined,
  caller: string,
  task: MutationTask,
): void {
  const gameState = requireSimulationQueue(state, 'postStepMutations', caller);
  enqueuePostPhysicsMutation(gameState, wrapMutation(gameState, task));
}
