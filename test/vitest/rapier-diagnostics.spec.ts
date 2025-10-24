import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import {
  recordRapierStepPanic,
  type RapierStepPanicSnapshot,
} from '../../src/game/simulationQueue.js';
import { createTestGameState } from './helpers/fixtures.js';

function setCopilotDebug(enabled: boolean): void {
  (window as Window & { __copilotDebugForce?: boolean }).__copilotDebugForce = enabled;
  try {
    delete (window as Window & { __copilot_rapierPanics?: RapierStepPanicSnapshot[] })
      .__copilot_rapierPanics;
  } catch {
    (
      window as Window & { __copilot_rapierPanics?: RapierStepPanicSnapshot[] }
    ).__copilot_rapierPanics = undefined;
  }
}

describe('recordRapierStepPanic', () => {
  beforeEach(() => {
    setCopilotDebug(true);
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-01-01T00:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
    setCopilotDebug(false);
  });

  it('captures diagnostics metadata and publishes a snapshot', () => {
    const state = createTestGameState();
    state.simulation.lastTickIndex = 42;
    state.simulation.lastTickDuration = 0.05;
    state.time = 12.34;

    const panic = new Error('memory access out of bounds');
    panic.stack = 'panic stack trace';

    const now = Date.now();
    recordRapierStepPanic(state, panic);

    const diagnostics = state.simulation.rapierDiagnostics;
    expect(diagnostics.stepPanics).toBe(1);
    expect(diagnostics.lastStepPanicTick).toBe(42);
    expect(diagnostics.lastStepPanicTime).toBeCloseTo(12.34);
    expect(diagnostics.lastStepPanicDelta).toBeCloseTo(0.05);
    expect(diagnostics.lastStepPanicMessage).toBe('memory access out of bounds');
    expect(diagnostics.lastStepPanicStack).toBe('panic stack trace');
    expect(diagnostics.lastStepPanicTimestamp).toBe(now);

    const buffer = (window as Window & { __copilot_rapierPanics?: RapierStepPanicSnapshot[] })
      .__copilot_rapierPanics;
    expect(buffer).toBeDefined();
    expect(buffer).toHaveLength(1);
    expect(buffer?.[0]).toMatchObject({
      tickIndex: 42,
      simulationTime: 12.34,
      delta: 0.05,
      message: 'memory access out of bounds',
      stack: 'panic stack trace',
      totalPanics: 1,
    });
  });

  it('increments counters but avoids duplicate snapshots within the same tick', () => {
    const state = createTestGameState();
    state.simulation.lastTickIndex = 7;
    state.simulation.lastTickDuration = 0.033;
    state.time = 3.5;

    recordRapierStepPanic(state, new Error('first panic'));
    const firstTimestamp = state.simulation.rapierDiagnostics.lastStepPanicTimestamp;

    recordRapierStepPanic(state, new Error('second panic'));

    const diagnostics = state.simulation.rapierDiagnostics;
    expect(diagnostics.stepPanics).toBe(2);
    expect(diagnostics.lastStepPanicTick).toBe(7);
    expect(diagnostics.lastStepPanicMessage).toBe('first panic');
    expect(diagnostics.lastStepPanicTimestamp).toBe(firstTimestamp);

    const buffer = (window as Window & { __copilot_rapierPanics?: RapierStepPanicSnapshot[] })
      .__copilot_rapierPanics;
    expect(buffer).toHaveLength(1);
  });

  it('handles non-Error throws by coercing the message and omitting stack traces', () => {
    const state = createTestGameState();
    state.simulation.lastTickIndex = 9;
    state.simulation.lastTickDuration = 0.04;
    state.time = 5.1;

    recordRapierStepPanic(state, 'string panic');

    const diagnostics = state.simulation.rapierDiagnostics;
    expect(diagnostics.stepPanics).toBe(1);
    expect(diagnostics.lastStepPanicMessage).toBe('string panic');
    expect(diagnostics.lastStepPanicStack).toBeUndefined();
  });

  it('trims the debug snapshot buffer to the most recent 20 entries', () => {
    const state = createTestGameState();

    for (let i = 0; i < 22; i += 1) {
      state.simulation.lastTickIndex = i;
      state.simulation.lastTickDuration = 0.02;
      state.time = i * 0.1;
      vi.setSystemTime(new Date(2025, 0, 1, 0, 0, 0, i));
      recordRapierStepPanic(state, new Error(`panic ${i}`));
    }

    const buffer = (window as Window & { __copilot_rapierPanics?: RapierStepPanicSnapshot[] })
      .__copilot_rapierPanics;
    expect(buffer).toHaveLength(20);
    expect(buffer?.[0].tickIndex).toBe(2);
    expect(buffer?.[buffer.length - 1].tickIndex).toBe(21);
  });
});
