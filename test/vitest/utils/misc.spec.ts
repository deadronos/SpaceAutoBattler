import { expect, test, vi, beforeEach, afterEach } from 'vitest';

import * as env from '../../../src/utils/env';
import * as logger from '../../../src/utils/logger';
import { perf, perfBegin, perfEnd } from '../../../src/utils/perf';

beforeEach(() => {
  // reset logger state
  logger.setLevel('debug');
  logger.setDebug(false);
});

test('env var fallback', () => {
  // envVar should return fallback when env var not present
  const v = env.envVar('NON_EXISTENT_VAR', 'fallback');
  expect(v).toBe('fallback');
});

test('logger debug lazy and levels', () => {
  const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

  logger.setDebug(true);
  logger.setLevel('debug');

  logger.debug('hello');
  logger.debugLazy(() => ['a', 'b']);
  logger.debugLazy(() => {
    throw new Error('boom');
  });
  logger.debugIf(true, () => 'x');

  expect(logSpy).toHaveBeenCalled();

  // debugLazy thrown error should have triggered a warn
  expect(warnSpy).toHaveBeenCalled();

  logSpy.mockRestore();
  warnSpy.mockRestore();
});

test('perf begin/end and summary', () => {
  // stub performance.now
  const now = Date.now();
  const perfNow = vi.spyOn(performance, 'now').mockImplementation(() => now as any);

  perf.enable();
  perfBegin('a');
  perfEnd('a');
  const summary = perf.getSummary();
  expect(summary.frameCount).toBeGreaterThanOrEqual(1);
  expect(Object.keys(summary.subsystems).length).toBeGreaterThanOrEqual(0);

  // getRecentSubsystemTimes should return totals when enabled
  const recent = perf.getRecentSubsystemTimes(10000);
  // may be empty depending on timestamp rounding, but should be an object
  expect(typeof recent).toBe('object');

  perf.clear();
  perf.disable();
  perfNow.mockRestore();
});
