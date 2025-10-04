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
import {
  flushDeferredMutations,
  flushPostPhysicsMutations,
  recordRapierStepPanic,
  recordSubsystemFailure,
} from './simulationQueue.js';
import { safeSnapshot } from './safeSnapshot.js';

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

  const runSafely = (name: string, fn: () => void) => {
    try {
      fn();
    } catch (error) {
      try {
        // Capture a small, safe snapshot for diagnostics and continue.
        const snap = safeSnapshot(state);
        recordSubsystemFailure(state, name, error, snap);
  } catch {
        // Best-effort: don't allow diagnostics to throw and break the tick.
        try {
          recordSubsystemFailure(state, name, error);
        } catch {
          // swallow
        }
      }
    }
  };

  runSafely('updateDecisionSystem', () => updateDecisionSystem(state, delta));

  runSafely('prepareShips', () => prepareShips(state, delta));
  runSafely('updateCarrierLaunchSystem', () => updateCarrierLaunchSystem(state, delta));
  runSafely('updateTurrets', () => updateTurrets(state, delta));
  runSafely('updateMotionSystem', () => updateMotionSystem(state, delta));
  runSafely('advanceProjectiles', () => advanceProjectiles(state, delta));

  runSafely('flushDeferredMutations', () => flushDeferredMutations(state));

  try {
    // EventQueue created with { auto: true } is managed internally by Rapier.
    // Passing it explicitly to step() causes "recursive use" errors.
    state.physicsWorld.step();
  } catch (error) {
    // Rapier panics are special and we rethrow after recording diagnostics so
    // upstream code can still handle a fatal physics panic if necessary.
    recordRapierStepPanic(state, error);
    throw error;
  }

  runSafely('flushPostPhysicsMutations', () => flushPostPhysicsMutations(state));

  runSafely('syncTransforms', () => syncTransforms(state));
  runSafely('resolveProjectiles', () => resolveProjectiles(state, delta));
  runSafely('updateExplosions', () => updateExplosions(state, delta));
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

function writeCommand(
  state: GameState,
  ship: ShipEntity,
  ai: AIState,
  profile: BehaviorProfile,
  target: ShipEntity | null,
  ...rest
) {
  // ...existing code...

  // Smoothing logic for heading
  const uiStore = useUiStore.getState();
  const smoothingEnabled = uiStore.aiSmoothingEnabled;
  // ...existing code...
  if (smoothingEnabled) {
    // Increase smoothing factor for stronger blending
    const smoothingFactor = 0.7; // was likely lower before (e.g. 0.3)
    ai.command.heading.lerp(ai.stickinessHeading, smoothingFactor);
  }
  // ...existing code...
}
