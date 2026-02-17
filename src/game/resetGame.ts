import type { GameState } from '../types/index.js';
import { resetMetrics } from './metrics.js';
import { enqueuePostPhysicsMutation } from './simulationQueue.js';
import { destroyEntity } from './entityLifecycle.js';
import { spawnInitialFleets } from './spawnFleets.js';
import { DEFAULT_GAME_SEED } from './createGameState.js';

/**
 * Resets the game state completely.
 * Destroys all entities, clears metrics, resets AI state, and respawns initial fleets.
 * Reset semantics intentionally reseed RNG to the default game seed for deterministic fresh-match reproduction.
 *
 * @param {GameState} state - The game state to reset.
 */
export function resetGame(state: GameState): void {
  for (const entity of [...state.world.entities]) {
    destroyEntity(state, entity);
  }
  resetMetrics(state.ai.metrics);
  state.rng.reset(DEFAULT_GAME_SEED);
  spawnInitialFleets(state);
  state.ai.cursor = 0;
  state.ai.accumulator = 0;
  state.ai.tickIndex = 0;
  state.ai.assignments.escorts.clear();
  state.ai.interrupts?.splice(0, state.ai.interrupts.length);
  if (state.ai.interruptState) {
    state.ai.interruptState.cooldownTick.clear();
    state.ai.interruptState.damageThisTick.clear();
    state.ai.interruptState.lastDamageTick = -1;
    state.ai.interruptState.vipThreatAssignments.clear();
  }
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
 *
 * @param {GameState} state - The game state to reset.
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
