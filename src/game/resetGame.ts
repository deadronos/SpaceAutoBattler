import type { GameState } from '../types/index.js';
import { resetMetrics } from './metrics.js';
import { enqueuePostPhysicsMutation } from './simulationQueue.js';
import { destroyEntity } from './entityLifecycle.js';
import { spawnInitialFleets } from './spawnFleets.js';

export function resetGame(state: GameState): void {
  for (const entity of [...state.world.entities]) {
    destroyEntity(state, entity);
  }
  resetMetrics(state.ai.metrics);
  spawnInitialFleets(state);
  state.ai.cursor = 0;
  state.ai.accumulator = 0;
  state.ai.tickIndex = 0;
  state.ai.assignments.escorts.clear();
  state.blackboard.nearestEnemy.clear();
  state.blackboard.threatToVip.clear();
  state.blackboard.teamPosture.blue = 'hold';
  state.blackboard.teamPosture.red = 'hold';
  state.blackboard.allyCentroid.blue.set(0, 0, 0);
  state.blackboard.allyCentroid.red.set(0, 0, 0);
  state.simulation.postStepMutations.length = 0;
}

/**
 * Schedule a reset to be executed after the current physics step completes.
 * This avoids Rapier console errors that occur when resetting during active physics stepping.
 */
export function requestReset(state: GameState): void {
  const queue = state.simulation.postStepMutations;
  if (queue.some((fn) => (fn as { __resetTag?: boolean }).__resetTag)) {
    return;
  }
  const op: (() => void) & { __resetTag?: boolean } = () => resetGame(state);
  op.__resetTag = true;
  enqueuePostPhysicsMutation(state, op);
}
