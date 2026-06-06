import type { GameState } from '../../types/index.js';
import { recordRapierStepPanic, recordSubsystemFailure } from '../simulationQueue.js';
import { safeSnapshot } from '../safeSnapshot.js';
import { reportQueryError } from '../../utils/errorReporting.js';

/**
 * A named subsystem function that can be run as part of the simulation pipeline.
 */
export type SubsystemFn = (state: GameState, delta: number) => void;

/**
 * Descriptor for a single subsystem in the declarative pipeline.
 */
export interface SystemStep {
  name: string;
  fn: SubsystemFn;
}

/**
 * Optional per-tick timing context kept on the simulation state.
 */
export interface SubsystemTimings {
  durations: Record<string, number>;
  lastTickIndex: number;
  lastTickTime: number;
}

/**
 * Creates a wrapped subsystem runner that handles error guards and profiling.
 *
 * @param state - The game state.
 * @returns A measurement function: `(name, fn) => void`.
 */
export function createMeasurementRunner(state: GameState) {
  const sim = state.simulation;

  const timings: SubsystemTimings = (sim.subsystemTimings ??= {
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
        const snap = safeSnapshot(state);
        recordSubsystemFailure(state, name, error, snap);
      } catch (snapError) {
        reportQueryError(`runSafely.snapshot.${name}`, snapError);
        try {
          recordSubsystemFailure(state, name, error);
        } catch (recordError) {
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
  const profileThisTick = Boolean(
    sim.profileSubsystems && sim.lastTickIndex % profileSampleRate === 0,
  );

  return (name: string, fn: () => void) => {
    if (!profileThisTick) {
      runSubsystem(name, fn);
      return;
    }

    const start = performance.now();
    runSubsystem(name, fn);
    timings.durations[name] = performance.now() - start;
  };
}

/**
 * Runs a list of system steps in order, each measured through the given runner.
 *
 * @param steps  - Ordered subsystem descriptors.
 * @param state  - The game state.
 * @param delta  - The time step in seconds.
 * @param runner - Measurement runner from `createMeasurementRunner`.
 */
export function executePipeline(
  steps: readonly SystemStep[],
  state: GameState,
  delta: number,
  runner: ReturnType<typeof createMeasurementRunner>,
): void {
  for (const step of steps) {
    runner(step.name, () => step.fn(state, delta));
  }
}

/**
 * Runs the Rapier physics step with timing and panic handling.
 *
 * @param state - The game state.
 * @param timings - The subsystem timings record to write `physicsStep` into.
 */
export function stepPhysics(state: GameState, timings: SubsystemTimings): void {
  const start = performance.now();
  try {
    state.physicsWorld.step();
  } catch (error) {
    recordRapierStepPanic(state, error);
    throw error;
  } finally {
    timings.durations.physicsStep = performance.now() - start;
  }
}
