import { describe, it, expect } from 'vitest';
import { recordSubsystemFailure } from '../src/game/simulationQueue.js';

describe('recordSubsystemFailure', () => {
  it('updates diagnostics on subsystem failure', () => {
    const mockState: any = {
      time: 10,
      simulation: {
        lastTickIndex: 42,
        lastTickDuration: 0.033,
        deferredMutations: [],
        postStepMutations: [],
        rapierDiagnostics: {
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
          // subsystem fields should be undefined initially
          subsystemFailures: 0,
          lastSubsystemFailureTick: -1,
          lastSubsystemFailureMessage: undefined,
          lastSubsystemFailureStack: undefined,
          lastSubsystemFailureTimestamp: 0,
        },
      },
    };

    recordSubsystemFailure(mockState as any, 'testSubsystem', new Error('boom'));

    expect(mockState.simulation.rapierDiagnostics.subsystemFailures).toBe(1);
    expect(mockState.simulation.rapierDiagnostics.lastSubsystemFailureTick).toBe(42);
    expect(mockState.simulation.rapierDiagnostics.lastSubsystemFailureMessage).toBe('boom');
  });
});
