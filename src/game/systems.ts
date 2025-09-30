import type { GameState } from '../types/index.js';
import { updateCarrierLaunchSystem } from './systems/carriers.js';
import { updateMotionSystem } from './systems/motion.js';
import { updateExplosions } from './explosions.js';
import {
  updateDecisionSystem,
  runDecisionTick as runDecisionTickInternal,
} from './systems/decision/manager.js';
import {
  refreshBlackboard,
  assignTeamRoles,
} from './systems/decision/blackboard.js';
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
import { prepareShips, executeAICommand, runLegacyShipBehavior } from './systems/shipControl.js';
import { fireProjectile, advanceProjectiles } from './systems/projectiles.js';
import { findNearestEnemy, updateTurrets } from './systems/turrets.js';
import { resolveProjectiles } from './systems/damage.js';
import { syncTransforms } from './systems/sync.js';
import { flushDeferredMutations, flushPostPhysicsMutations } from './simulationQueue.js';

export { updateDecisionSystem, fireProjectile, findNearestEnemy };

export function runDecisionTick(state: GameState, delta: number): void {
  runDecisionTickInternal(state, delta);
}

export function updateGame(state: GameState, delta: number): void {
  const sim = state.simulation;
  sim.lastTickStart = state.time;
  sim.lastTickDuration = delta;
  sim.lastTickIndex += 1;

  state.time += delta;

  updateDecisionSystem(state, delta);

  prepareShips(state, delta);
  updateCarrierLaunchSystem(state, delta);
  updateTurrets(state, delta);
  updateMotionSystem(state, delta);
  advanceProjectiles(state, delta);

  flushDeferredMutations(state);

  state.physicsWorld.step(state.eventQueue);

  flushPostPhysicsMutations(state);

  syncTransforms(state);
  resolveProjectiles(state, delta);
  updateExplosions(state, delta);
}

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
  runLegacyShipBehavior,
  computeInterceptHeadingVector,
  executeAICommand,
};
