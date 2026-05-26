import { beforeEach, describe, it, expect } from 'vite-plus/test';
import {
  flushDeferredMutations,
  recordRapierStepPanic,
  recordSubsystemFailure,
} from '../src/game/simulationQueue.js';
import {
  ErrorCategory,
  getRecentErrors,
  getErrorCounts,
  resetErrorCounts,
  setErrorReportingEnabled,
} from '../src/utils/errorReporting.js';

function createMockState() {
  return {
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
        subsystemFailures: 0,
        lastSubsystemFailureTick: -1,
        lastSubsystemFailureMessage: undefined,
        lastSubsystemFailureStack: undefined,
        lastSubsystemFailureTimestamp: 0,
      },
    },
  };
}

describe('recordSubsystemFailure', () => {
  beforeEach(() => {
    resetErrorCounts();
    setErrorReportingEnabled(true);
  });

  it('updates diagnostics on subsystem failure', () => {
    const mockState: any = createMockState();

    recordSubsystemFailure(mockState as any, 'testSubsystem', new Error('boom'));

    expect(mockState.simulation.rapierDiagnostics.subsystemFailures).toBe(1);
    expect(mockState.simulation.rapierDiagnostics.lastSubsystemFailureTick).toBe(42);
    expect(mockState.simulation.rapierDiagnostics.lastSubsystemFailureMessage).toBe('boom');
  });

  it('reports recoverable subsystem failures to the shared game error buffer', () => {
    const mockState: any = createMockState();

    recordSubsystemFailure(mockState as any, 'testSubsystem', new Error('boom'));

    const [report] = getRecentErrors(1);
    expect(getErrorCounts()[ErrorCategory.Physics]).toBe(1);
    expect(report!.context).toMatchObject({
      code: 'subsystem-failure',
      fatal: false,
      severity: 'recoverable',
      source: 'simulationQueue.recordSubsystemFailure',
      subsystem: 'testSubsystem',
    });
  });

  it('reports deferred mutation failures as recoverable physics errors', () => {
    const mockState: any = createMockState();
    mockState.simulation.deferredMutations.push(() => {
      throw new Error('queue boom');
    });

    flushDeferredMutations(mockState as any);

    const [report] = getRecentErrors(1);
    expect(mockState.simulation.rapierDiagnostics.deferredMutationFailures).toBe(1);
    expect(report!.context).toMatchObject({
      code: 'deferred-mutation-failure',
      fatal: false,
      severity: 'recoverable',
      source: 'simulationQueue.flushQueue',
      tag: 'pre',
    });
  });

  it('reports rapier panics as fatal physics errors', () => {
    const mockState: any = createMockState();

    recordRapierStepPanic(mockState as any, new Error('panic'));

    const [report] = getRecentErrors(1);
    expect(mockState.simulation.rapierDiagnostics.stepPanics).toBe(1);
    expect(report!.context).toMatchObject({
      code: 'rapier-step-panic',
      fatal: true,
      severity: 'fatal',
      source: 'simulationQueue.recordRapierStepPanic',
    });
  });
});
