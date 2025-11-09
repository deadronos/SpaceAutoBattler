import type { GameState } from '../../types/index.js';
import {
  enqueueDeferredMutation,
  enqueuePostPhysicsMutation,
  recordRapierGuardTrip,
} from '../simulationQueue.js';

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

export function withDeferredEnqueue(
  state: GameState | null | undefined,
  caller: string,
  task: MutationTask,
): void {
  const gameState = requireSimulationQueue(state, 'deferredMutations', caller);
  enqueueDeferredMutation(gameState, wrapMutation(gameState, task));
}

export function withPostEnqueue(
  state: GameState | null | undefined,
  caller: string,
  task: MutationTask,
): void {
  const gameState = requireSimulationQueue(state, 'postStepMutations', caller);
  enqueuePostPhysicsMutation(gameState, wrapMutation(gameState, task));
}
