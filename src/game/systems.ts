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
import { reportQueryError } from '../utils/errorReporting.js';

export { updateDecisionSystem, fireProjectile, findNearestEnemy };

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
 * Main game update loop. Runs all systems in order.
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

  const timings =
    sim.subsystemTimings ??
    (sim.subsystemTimings = {
      durations: {},
      lastTickIndex: -1,
      lastTickTime: 0,
    });
  timings.lastTickIndex = sim.lastTickIndex;
  timings.lastTickTime = state.time;

  const runSafely = (name: string, fn: () => void) => {
    try {
      fn();
    } catch (error) {
      try {
        // Capture a small, safe snapshot for diagnostics and continue.
        const snap = safeSnapshot(state);
        recordSubsystemFailure(state, name, error, snap);
      } catch (snapError) {
        // Best-effort: don't allow diagnostics to throw and break the tick.
        // Expected: safeSnapshot may fail if state is corrupted
        reportQueryError(`runSafely.snapshot.${name}`, snapError);
        try {
          recordSubsystemFailure(state, name, error);
        } catch (recordError) {
          // Expected: Recording may fail if simulation state is invalid
          reportQueryError(`runSafely.record.${name}`, recordError);
        }
      }
    }
  };

  const runSubsystem = (name: string, fn: () => void) => {
    if (sim.enableSubsystemGuards) {
      runSafely(name, fn);
      return;
    }
    fn();
  };

  const profileSampleRate = Math.max(1, sim.profileSampleRate ?? 1);
  const profileThisTick = Boolean(sim.profileSubsystems && sim.lastTickIndex % profileSampleRate === 0);

  const measureSubsystem = (name: string, fn: () => void) => {
    if (!profileThisTick) {
      runSubsystem(name, fn);
      return;
    }

    const start = performance.now();
    runSubsystem(name, fn);
    timings.durations[name] = performance.now() - start;
  };

  measureSubsystem('updateDecisionSystem', () => updateDecisionSystem(state, delta));

  measureSubsystem('prepareShips', () => prepareShips(state, delta));
  measureSubsystem('updateCarrierLaunchSystem', () => updateCarrierLaunchSystem(state, delta));
  measureSubsystem('updateTurrets', () => updateTurrets(state, delta));
  measureSubsystem('updateMotionSystem', () => updateMotionSystem(state, delta));
  measureSubsystem('advanceProjectiles', () => advanceProjectiles(state, delta));

  measureSubsystem('flushDeferredMutations', () => flushDeferredMutations(state));

  const physicsStart = performance.now();
  try {
    // EventQueue created with { auto: true } is managed internally by Rapier.
    // Passing it explicitly to step() causes "recursive use" errors.
    state.physicsWorld.step();
  } catch (error) {
    // Rapier panics are special and we rethrow after recording diagnostics so
    // upstream code can still handle a fatal physics panic if necessary.
    recordRapierStepPanic(state, error);
    throw error;
  } finally {
    timings.durations.physicsStep = performance.now() - physicsStart;
  }

  measureSubsystem('flushPostPhysicsMutations', () => flushPostPhysicsMutations(state));

  measureSubsystem('syncTransforms', () => syncTransforms(state));
  measureSubsystem('resolveProjectiles', () => resolveProjectiles(state, delta));
  measureSubsystem('updateExplosions', () => updateExplosions(state, delta));
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
