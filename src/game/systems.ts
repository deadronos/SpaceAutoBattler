import type { GameState } from '../types/index.js';
import { updateCarrierLaunchSystem } from './systems/carriers.js';
import { updateMotionSystem } from './systems/motion.js';
import { updateExplosions } from './explosions.js';
import { updateDecisionSystem } from './systems/decision/manager.js';
import { refreshBlackboard, assignTeamRoles } from './systems/decision/blackboard.js';
import {
  selectIntent,
  scoreAttackIntent,
  scoreKiteIntent,
  scoreEscortIntent,
  scoreInterceptIntent,
  scoreRepositionIntent,
  scoreRegroupIntent,
  scoreFleeIntent,
  tieBreak,
  computeLod,
  writeCommand,
  computeInterceptHeadingVector,
} from './systems/decision/intents.js';
import { prepareShips, executeAICommand } from './systems/shipControl.js';
import { fireProjectile, advanceProjectiles } from './systems/projectiles.js';
import { updateTurrets } from './systems/turrets.js';
import { findNearestEnemy } from './utils/targetSelection.js';
import { resolveProjectiles } from './systems/damage.js';
import { syncTransforms } from './systems/sync.js';
import { flushDeferredMutations, flushPostPhysicsMutations } from './simulationQueue.js';
import {
  createMeasurementRunner,
  executePipeline,
  stepPhysics,
  type SystemStep,
} from './systems/pipeline.js';

export { updateDecisionSystem, fireProjectile, findNearestEnemy };

/**
 * Ordered simulation pipeline — add new systems here in dependency order.
 * The `updateGame` loop iterates this array so ordering is explicit and reviewable.
 */
const SIMULATION_PIPELINE: readonly SystemStep[] = [
  { name: 'updateDecisionSystem', fn: updateDecisionSystem },
  { name: 'prepareShips', fn: prepareShips },
  { name: 'updateCarrierLaunchSystem', fn: updateCarrierLaunchSystem },
  { name: 'updateTurrets', fn: updateTurrets },
  { name: 'updateMotionSystem', fn: updateMotionSystem },
  { name: 'advanceProjectiles', fn: advanceProjectiles },
];

/**
 * Post-physics pipeline — systems that depend on physics step results.
 */
const POST_PHYSICS_PIPELINE: readonly SystemStep[] = [
  { name: 'syncTransforms', fn: syncTransforms },
  { name: 'resolveProjectiles', fn: resolveProjectiles },
  { name: 'updateExplosions', fn: updateExplosions },
];

/**
 * Run a single decision tick for all AI-controlled ships.
 * Alias for updateDecisionSystem, provided for test compatibility.
 *
 * @param {GameState} state - The game state.
 * @param {number} delta - The time delta.
 */
export function runDecisionTick(state: GameState, delta: number): void {
  updateDecisionSystem(state, delta);
}

/**
 * Main game update loop. Runs all systems in order through a declarative pipeline.
 *
 * @param {GameState} state - The game state.
 * @param {number} delta - The time step in seconds.
 */
export function updateGame(state: GameState, delta: number): void {
  const sim = state.simulation;
  sim.lastTickStart = state.time;
  sim.lastTickDuration = delta;
  sim.lastTickIndex += 1;

  state.time += delta;

  const measure = createMeasurementRunner(state);
  const timings = sim.subsystemTimings!;

  // Pre-physics pipeline
  executePipeline(SIMULATION_PIPELINE, state, delta, measure);

  // Deferred mutations must flush before physics to avoid iteration conflicts
  measure('flushDeferredMutations', () => flushDeferredMutations(state));

  // Rapier physics step
  stepPhysics(state, timings);

  // Post-physics mutations
  measure('flushPostPhysicsMutations', () => flushPostPhysicsMutations(state));

  // Post-physics pipeline
  executePipeline(POST_PHYSICS_PIPELINE, state, delta, measure);
}

/**
 * Test hooks exposing internal system functions.
 */
export const __aiTestHooks = {
  updateDecisionSystem,
  refreshBlackboard,
  assignTeamRoles,
  selectIntent,
  scoreAttackIntent,
  scoreKiteIntent,
  scoreEscortIntent,
  scoreInterceptIntent,
  scoreRepositionIntent,
  scoreRegroupIntent,
  scoreFleeIntent,
  tieBreak,
  computeLod,
  writeCommand,
  prepareShips,
  computeInterceptHeadingVector,
  executeAICommand,
};
