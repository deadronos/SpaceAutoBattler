import { beforeEach, describe, expect, it } from 'vite-plus/test';
import {
  ErrorCategory,
  getGameErrors,
  reportFatalGameError,
  reportRecoverableGameError,
  resetGameErrorReporting,
  setGameErrorReportingEnabled,
} from '../../src/game/errors.js';

describe('game errors', () => {
  beforeEach(() => {
    resetGameErrorReporting();
    setGameErrorReportingEnabled(true);
  });

  it('stores recoverable game errors with severity metadata', () => {
    reportRecoverableGameError(ErrorCategory.Config, 'recoverable config issue', {
      source: 'test.recoverable',
      code: 'recoverable-config',
      context: { subsystem: 'config' },
    });

    const [report] = getGameErrors(1);
    expect(report.context).toMatchObject({
      code: 'recoverable-config',
      fatal: false,
      severity: 'recoverable',
      source: 'test.recoverable',
      subsystem: 'config',
    });
  });

  it('stores fatal game errors with severity metadata', () => {
    reportFatalGameError(
      ErrorCategory.Physics,
      'fatal physics issue',
      {
        source: 'test.fatal',
        code: 'fatal-physics',
      },
      new Error('physics panic'),
    );

    const [report] = getGameErrors(1);
    expect(report.context).toMatchObject({
      code: 'fatal-physics',
      fatal: true,
      severity: 'fatal',
      source: 'test.fatal',
    });
    expect(report.stack).toContain('physics panic');
  });
});
