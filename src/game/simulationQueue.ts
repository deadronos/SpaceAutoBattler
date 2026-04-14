import type { GameState, DeferredMutation } from '../types/index.js';
import { isCopilotDebugEnabled } from '../utils/copilotDebug.js';
import { appendCappedMutable } from '../utils/cappedBuffer.js';
import { ErrorCategory, reportFatalGameError, reportRecoverableGameError } from './errors.js';

export interface RapierStepPanicSnapshot {
  tickIndex: number;
  simulationTime: number;
  delta: number;
  message: string;
  stack?: string;
  timestamp: number;
  totalPanics: number;
  /** Optional subsystem name when the snapshot was created due to a subsystem failure. */
  subsystem?: string;
  /** Optional sanitized state snapshot suitable for diagnostics and logging. */
  sanitizedState?: unknown;
}

const MAX_RAPIER_PANIC_SNAPSHOTS = 20;

const stringifyUnknown = (value: unknown, fallback: string): string => {
  if (value == null) {
    return fallback;
  }
  if (
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean' ||
    typeof value === 'bigint'
  ) {
    return String(value);
  }
  if (typeof value === 'symbol') {
    return value.toString();
  }
  try {
    return JSON.stringify(value) ?? fallback;
  } catch (error) {
    reportRecoverableGameError(
      ErrorCategory.Query,
      'Failed to stringify simulation diagnostic value',
      {
        source: 'simulationQueue.stringifyUnknown',
        code: 'simulation-diagnostic-stringify',
      },
      error,
    );
    return fallback;
  }
};

export function publishRapierPanicSnapshot(snapshot: RapierStepPanicSnapshot): void {
  if (!isCopilotDebugEnabled()) {
    return;
  }
  if (typeof window === 'undefined') {
    return;
  }
  try {
    const win = window as Window & { __copilot_rapierPanics?: RapierStepPanicSnapshot[] };
    const buffer = win.__copilot_rapierPanics ?? [];
    appendCappedMutable(buffer, snapshot, MAX_RAPIER_PANIC_SNAPSHOTS);
    win.__copilot_rapierPanics = buffer;
  } catch (error) {
    reportRecoverableGameError(
      ErrorCategory.Query,
      'Failed to publish Rapier panic snapshot',
      {
        source: 'simulationQueue.publishRapierPanicSnapshot',
        code: 'rapier-panic-publish',
      },
      error,
    );
  }
}

export function recordRapierStepPanic(state: GameState, error: unknown): void {
  const diagnostics = state.simulation.rapierDiagnostics;
  diagnostics.stepPanics += 1;

  const tickIndex = state.simulation.lastTickIndex;
  if (diagnostics.lastStepPanicTick === tickIndex) {
    return;
  }

  const message = error instanceof Error ? error.message : stringifyUnknown(error, 'Rapier panic');
  const stack = error instanceof Error ? (error.stack ?? undefined) : undefined;
  const timestamp = Date.now();

  diagnostics.lastStepPanicTick = tickIndex;
  diagnostics.lastStepPanicTime = state.time;
  diagnostics.lastStepPanicDelta = state.simulation.lastTickDuration;
  diagnostics.lastStepPanicMessage = message;
  diagnostics.lastStepPanicStack = stack;
  diagnostics.lastStepPanicTimestamp = timestamp;

  reportFatalGameError(
    ErrorCategory.Physics,
    'Rapier step panic',
    {
      source: 'simulationQueue.recordRapierStepPanic',
      code: 'rapier-step-panic',
      context: { tickIndex },
    },
    error,
  );

  publishRapierPanicSnapshot({
    tickIndex,
    simulationTime: state.time,
    delta: state.simulation.lastTickDuration,
    message,
    stack,
    timestamp,
    totalPanics: diagnostics.stepPanics,
  });
}

export function recordSubsystemFailure(
  state: GameState,
  subsystem: string,
  error: unknown,
  sanitizedState?: unknown,
): void {
  const diagnostics = state.simulation.rapierDiagnostics;
  diagnostics.subsystemFailures = (diagnostics.subsystemFailures || 0) + 1;

  const tickIndex = state.simulation.lastTickIndex;
  diagnostics.lastSubsystemFailureTick = tickIndex;
  diagnostics.lastSubsystemFailureTimestamp = Date.now();
  diagnostics.lastSubsystemFailureMessage =
    error instanceof Error ? error.message : stringifyUnknown(error, 'Subsystem failure');
  diagnostics.lastSubsystemFailureStack =
    error instanceof Error ? (error.stack ?? undefined) : undefined;

  reportRecoverableGameError(
    ErrorCategory.Physics,
    `Subsystem ${subsystem} failed`,
    {
      source: 'simulationQueue.recordSubsystemFailure',
      code: 'subsystem-failure',
      context: { subsystem, tickIndex },
    },
    error,
  );

  publishRapierPanicSnapshot({
    tickIndex,
    simulationTime: state.time,
    delta: state.simulation.lastTickDuration,
    message: diagnostics.lastSubsystemFailureMessage ?? 'Subsystem failure',
    stack: diagnostics.lastSubsystemFailureStack,
    timestamp: diagnostics.lastSubsystemFailureTimestamp,
    totalPanics: diagnostics.subsystemFailures,
    subsystem,
    sanitizedState,
  });
}

export function enqueueDeferredMutation(state: GameState, op: DeferredMutation): void {
  if (typeof op !== 'function') return;
  if (!state) return;
  if (!state.simulation || !Array.isArray(state.simulation.deferredMutations)) {
    throw new Error(
      'enqueueDeferredMutation requires state.simulation.deferredMutations to be initialized. Initialize a SimulationClock on state.simulation (use createTestGameState in tests).',
    );
  }
  state.simulation.deferredMutations.push(op);
}

export function enqueuePostPhysicsMutation(state: GameState, op: DeferredMutation): void {
  if (typeof op !== 'function') return;
  if (!state) return;
  if (!state.simulation || !Array.isArray(state.simulation.postStepMutations)) {
    throw new Error(
      'enqueuePostPhysicsMutation requires state.simulation.postStepMutations to be initialized. Initialize a SimulationClock on state.simulation (use createTestGameState in tests).',
    );
  }
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
      reportRecoverableGameError(
        ErrorCategory.Physics,
        `${tag}-physics deferred mutation failed`,
        {
          source: 'simulationQueue.flushQueue',
          code: 'deferred-mutation-failure',
          context: { tag, tickIndex: state.simulation.lastTickIndex },
        },
        error,
      );
    }
  }
}

export function flushDeferredMutations(state: GameState): void {
  flushQueue(state, state.simulation.deferredMutations, 'pre');
}

export function flushPostPhysicsMutations(state: GameState): void {
  flushQueue(state, state.simulation.postStepMutations, 'post');
}
