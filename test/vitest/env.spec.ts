import { afterEach, describe, expect, it } from 'vite-plus/test';
import { isProductionEnv, readBooleanEnv, readStringEnv } from '../../src/utils/env.js';
import { ErrorCategory, getErrorCounts, resetErrorCounts } from '../../src/utils/errorReporting.js';

const KEYS = ['SAB_TEST_BOOL', 'SAB_TEST_STR'] as const;

afterEach(() => {
  for (const key of KEYS) delete process.env[key];
  resetErrorCounts();
});

describe('env helpers', () => {
  it('reads process.env with defaults and boolean normalisation', () => {
    process.env.SAB_TEST_BOOL = 'on';
    process.env.SAB_TEST_STR = 'hi';

    expect(readBooleanEnv('SAB_TEST_BOOL', false)).toBe(true);
    expect(readBooleanEnv('SAB_MISSING', true)).toBe(true);
    expect(readStringEnv('SAB_TEST_STR', 'def')).toBe('hi');
    expect(readStringEnv('SAB_MISSING', 'def')).toBe('def');
  });

  it('reports production as a boolean', () => {
    expect(typeof isProductionEnv()).toBe('boolean');
  });

  it('reports config errors when process.env access throws in isProductionEnv', () => {
    const originalEnvDescriptor = Object.getOwnPropertyDescriptor(process, 'env');
    Object.defineProperty(process, 'env', {
      configurable: true,
      get() {
        throw new Error('env unavailable');
      },
    });

    try {
      expect(typeof isProductionEnv()).toBe('boolean');
      expect(getErrorCounts()[ErrorCategory.Config]).toBe(1);
    } finally {
      if (originalEnvDescriptor) {
        Object.defineProperty(process, 'env', originalEnvDescriptor);
      }
    }
  });
});
