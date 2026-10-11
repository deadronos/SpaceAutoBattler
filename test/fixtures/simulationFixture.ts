import type { GameState } from '../../src/types/index.js';

/**
 * Full Rapier diagnostics block used by test fixtures. Centralised so the
 * three state factories (and any new ones) stay in sync.
 */
export function createTestRapierDiagnostics(): GameState['simulation']['rapierDiagnostics'] {
  return {
    deferredMutationFailures: 0,
    guardTrips: 0,
    lastFailureTick: -1,
    lastGuardTick: -1,
    lastDeferredMutationError: undefined,
    stepPanics: 0,
    lastStepPanicTick: -1,
    lastStepPanicTime: 0,
    lastStepPanicDelta: 0,
    lastStepPanicMessage: undefined,
    lastStepPanicStack: undefined,
    lastStepPanicTimestamp: 0,
    subsystemFailures: 0,
    lastSubsystemFailureTick: -1,
    lastSubsystemFailureMessage: undefined,
    lastSubsystemFailureStack: undefined,
    lastSubsystemFailureTimestamp: 0,
  };
}

/**
 * Minimal simulation block for test GameStates, with fully-initialised
 * diagnostics and subsystem timings.
 *
 * @param {Partial<GameState['simulation']>} [overrides] - Field overrides.
 * @returns {GameState['simulation']}
 */
export function createTestSimulationState(
  overrides: Partial<GameState['simulation']> = {},
): GameState['simulation'] {
  return {
    step: 1 / 20,
    accumulator: 0,
    maxSubSteps: 5,
    profileSubsystems: false,
    profileSampleRate: 1,
    enableSubsystemGuards: true,
    alpha: 0,
    lastTickIndex: 0,
    lastTickStart: 0,
    lastTickDuration: 1 / 20,
    deferredMutations: [],
    postStepMutations: [],
    rapierDiagnostics: createTestRapierDiagnostics(),
    subsystemTimings: {
      durations: {},
      lastTickIndex: -1,
      lastTickTime: 0,
    },
    ...overrides,
  };
}
