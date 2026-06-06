import { describe, it, expect, vi } from 'vite-plus/test';
import {
  createMeasurementRunner,
  executePipeline,
  stepPhysics,
  type SubsystemTimings,
  type SystemStep,
} from '../../../src/game/systems/pipeline.js';
import type { GameState } from '../../../src/types/index.js';

vi.mock('../../../src/game/simulationQueue.js', () => ({
  recordRapierStepPanic: vi.fn(),
  recordSubsystemFailure: vi.fn(),
}));

vi.mock('../../../src/utils/errorReporting.js', () => ({
  reportQueryError: vi.fn(),
}));

vi.mock('../../../src/game/safeSnapshot.js', () => ({
  safeSnapshot: vi.fn(() => ({})),
}));

function mockGameState(overrides: Partial<GameState['simulation']> = {}): GameState {
  return {
    time: 0,
    simulation: {
      lastTickStart: 0,
      lastTickDuration: 0.016,
      lastTickIndex: 0,
      enableSubsystemGuards: false,
      profileSubsystems: false,
      profileSampleRate: 1,
      ...overrides,
    },
    physicsWorld: {
      step: vi.fn(),
    },
  } as unknown as GameState;
}

describe('executePipeline', () => {
  it('runs steps in declared order with state and delta', () => {
    const state = mockGameState();
    const calls: string[] = [];
    const steps: SystemStep[] = [
      { name: 'A', fn: (s, d) => calls.push(`A:${d}`) },
      { name: 'B', fn: (s, d) => calls.push(`B:${d}`) },
      { name: 'C', fn: (s, d) => calls.push(`C:${d}`) },
    ];
    const runner = createMeasurementRunner(state);
    executePipeline(steps, state, 0.016, runner);
    expect(calls).toEqual(['A:0.016', 'B:0.016', 'C:0.016']);
  });

  it('passes the correct state reference to each step', () => {
    const state = mockGameState();
    const seen: GameState[] = [];
    const steps: SystemStep[] = [{ name: 'X', fn: (s) => seen.push(s) }];
    const runner = createMeasurementRunner(state);
    executePipeline(steps, state, 0.016, runner);
    expect(seen[0]).toBe(state);
  });
});

describe('stepPhysics', () => {
  it('calls physicsWorld.step() and records timing', () => {
    const state = mockGameState();
    const timings: SubsystemTimings = { durations: {}, lastTickIndex: 0, lastTickTime: 0 };
    stepPhysics(state, timings);
    expect(state.physicsWorld.step).toHaveBeenCalledTimes(1);
    expect(timings.durations.physicsStep).toBeGreaterThanOrEqual(0);
  });

  it('rethrows errors from step() after recording', () => {
    const state = mockGameState();
    (state.physicsWorld.step as ReturnType<typeof vi.fn>).mockImplementation(() => {
      throw new Error('rapier panic');
    });
    const timings: SubsystemTimings = { durations: {}, lastTickIndex: 0, lastTickTime: 0 };
    expect(() => stepPhysics(state, timings)).toThrow('rapier panic');
    // Timing is still recorded in the finally block
    expect(timings.durations.physicsStep).toBeGreaterThanOrEqual(0);
  });
});

describe('createMeasurementRunner', () => {
  it('returns a measurement function', () => {
    const state = mockGameState();
    const measure = createMeasurementRunner(state);
    expect(typeof measure).toBe('function');
  });

  it('calls the subsystem function', () => {
    const state = mockGameState();
    const fn = vi.fn();
    const measure = createMeasurementRunner(state);
    measure('testSystem', fn);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('records timing when profiling is enabled', () => {
    const state = mockGameState({
      profileSubsystems: true,
      profileSampleRate: 1,
      lastTickIndex: 0,
    });
    const fn = vi.fn();
    const measure = createMeasurementRunner(state);
    measure('testSystem', fn);
    // createMeasurementRunner initializes timings on state.simulation.subsystemTimings
    const sim = state.simulation as unknown as Record<string, unknown>;
    const timings = sim.subsystemTimings as SubsystemTimings;
    expect(timings.durations.testSystem).toBeGreaterThanOrEqual(0);
  });

  it('swallows errors when subsystem guards are enabled', () => {
    const state = mockGameState({
      enableSubsystemGuards: true,
      lastTickIndex: 0,
    });
    const fn = vi.fn().mockImplementation(() => {
      throw new Error('subsystem crash');
    });
    const measure = createMeasurementRunner(state);
    // Should not throw when guards are on
    expect(() => measure('crashy', fn)).not.toThrow();
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('does not swallow errors when subsystem guards are disabled', () => {
    const state = mockGameState({
      enableSubsystemGuards: false,
      lastTickIndex: 0,
    });
    const fn = vi.fn().mockImplementation(() => {
      throw new Error('subsystem crash');
    });
    const measure = createMeasurementRunner(state);
    expect(() => measure('crashy', fn)).toThrow('subsystem crash');
  });
});
