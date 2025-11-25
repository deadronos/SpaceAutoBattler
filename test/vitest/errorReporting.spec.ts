import { describe, it, expect, beforeEach } from 'vitest';
import {
  ErrorCategory,
  reportError,
  reportMaterialError,
  reportPhysicsError,
  reportLifecycleError,
  reportE2EError,
  reportQueryError,
  reportWebGLError,
  reportConfigError,
  getErrorCounts,
  getTotalErrorCount,
  getRecentErrors,
  resetErrorCounts,
  setErrorReportingEnabled,
  isErrorReportingEnabled,
} from '../../src/utils/errorReporting.js';

describe('errorReporting', () => {
  beforeEach(() => {
    resetErrorCounts();
  });

  describe('reportError', () => {
    it('increments the counter for the specified category', () => {
      reportError(ErrorCategory.Physics, 'test error');
      const counts = getErrorCounts();
      expect(counts[ErrorCategory.Physics]).toBe(1);
    });

    it('increments counters independently for each category', () => {
      reportError(ErrorCategory.Physics, 'physics error');
      reportError(ErrorCategory.Material, 'material error');
      reportError(ErrorCategory.Physics, 'another physics error');

      const counts = getErrorCounts();
      expect(counts[ErrorCategory.Physics]).toBe(2);
      expect(counts[ErrorCategory.Material]).toBe(1);
      expect(counts[ErrorCategory.WebGL]).toBe(0);
    });

    it('stores error reports when enabled', () => {
      setErrorReportingEnabled(true);
      reportError(ErrorCategory.Physics, 'test error', { entityId: 123 });

      const reports = getRecentErrors();
      expect(reports).toHaveLength(1);
      expect(reports[0].category).toBe(ErrorCategory.Physics);
      expect(reports[0].message).toBe('test error');
      expect(reports[0].context).toEqual({ entityId: 123 });
    });

    it('captures error stack when Error is provided', () => {
      setErrorReportingEnabled(true);
      const error = new Error('original error');
      reportError(ErrorCategory.Lifecycle, 'wrapped error', undefined, error);

      const reports = getRecentErrors();
      expect(reports[0].stack).toContain('original error');
    });

    it('limits stored reports to maxReports', () => {
      setErrorReportingEnabled(true);
      for (let i = 0; i < 150; i++) {
        reportError(ErrorCategory.Physics, `error ${i}`);
      }

      const reports = getRecentErrors(200);
      expect(reports.length).toBeLessThanOrEqual(100);
    });
  });

  describe('category-specific helpers', () => {
    it('reportMaterialError increments Material category', () => {
      reportMaterialError('needsUpdate', 'ShaderMaterial');
      expect(getErrorCounts()[ErrorCategory.Material]).toBe(1);
    });

    it('reportPhysicsError increments Physics category', () => {
      reportPhysicsError('removeCollider', 42);
      expect(getErrorCounts()[ErrorCategory.Physics]).toBe(1);
    });

    it('reportLifecycleError increments Lifecycle category', () => {
      reportLifecycleError('destroy', 'Ship', 99);
      expect(getErrorCounts()[ErrorCategory.Lifecycle]).toBe(1);
    });

    it('reportE2EError increments E2E category', () => {
      reportE2EError('tick');
      expect(getErrorCounts()[ErrorCategory.E2E]).toBe(1);
    });

    it('reportQueryError increments Query category', () => {
      reportQueryError('ships');
      expect(getErrorCounts()[ErrorCategory.Query]).toBe(1);
    });

    it('reportWebGLError increments WebGL category', () => {
      reportWebGLError('getExtension');
      expect(getErrorCounts()[ErrorCategory.WebGL]).toBe(1);
    });

    it('reportConfigError increments Config category', () => {
      reportConfigError('DEBUG_MODE');
      expect(getErrorCounts()[ErrorCategory.Config]).toBe(1);
    });
  });

  describe('getErrorCounts', () => {
    it('returns a copy of the counts object', () => {
      reportError(ErrorCategory.Physics, 'error');
      const counts1 = getErrorCounts();
      const counts2 = getErrorCounts();
      expect(counts1).not.toBe(counts2);
      expect(counts1).toEqual(counts2);
    });

    it('initializes all categories to zero', () => {
      const counts = getErrorCounts();
      for (const category of Object.values(ErrorCategory)) {
        expect(counts[category]).toBe(0);
      }
    });
  });

  describe('getTotalErrorCount', () => {
    it('returns sum of all category counts', () => {
      reportError(ErrorCategory.Physics, 'error 1');
      reportError(ErrorCategory.Physics, 'error 2');
      reportError(ErrorCategory.Material, 'error 3');
      expect(getTotalErrorCount()).toBe(3);
    });

    it('returns zero when no errors reported', () => {
      expect(getTotalErrorCount()).toBe(0);
    });
  });

  describe('getRecentErrors', () => {
    beforeEach(() => {
      setErrorReportingEnabled(true);
    });

    it('returns most recent errors', () => {
      reportError(ErrorCategory.Physics, 'error 1');
      reportError(ErrorCategory.Material, 'error 2');
      reportError(ErrorCategory.WebGL, 'error 3');

      const recent = getRecentErrors(2);
      expect(recent).toHaveLength(2);
      expect(recent[0].message).toBe('error 2');
      expect(recent[1].message).toBe('error 3');
    });

    it('returns all errors if limit exceeds count', () => {
      reportError(ErrorCategory.Physics, 'only error');
      const recent = getRecentErrors(10);
      expect(recent).toHaveLength(1);
    });
  });

  describe('resetErrorCounts', () => {
    it('resets all counts to zero', () => {
      reportError(ErrorCategory.Physics, 'error');
      reportError(ErrorCategory.Material, 'error');
      resetErrorCounts();

      const counts = getErrorCounts();
      expect(getTotalErrorCount()).toBe(0);
      expect(counts[ErrorCategory.Physics]).toBe(0);
      expect(counts[ErrorCategory.Material]).toBe(0);
    });

    it('clears the reports buffer', () => {
      setErrorReportingEnabled(true);
      reportError(ErrorCategory.Physics, 'error');
      resetErrorCounts();
      expect(getRecentErrors()).toHaveLength(0);
    });
  });

  describe('setErrorReportingEnabled / isErrorReportingEnabled', () => {
    it('can enable and disable reporting', () => {
      setErrorReportingEnabled(false);
      expect(isErrorReportingEnabled()).toBe(false);

      setErrorReportingEnabled(true);
      expect(isErrorReportingEnabled()).toBe(true);
    });

    it('does not store reports when disabled', () => {
      setErrorReportingEnabled(false);
      reportError(ErrorCategory.Physics, 'error');

      // Counts still increment
      expect(getErrorCounts()[ErrorCategory.Physics]).toBe(1);
      // But reports are not stored
      expect(getRecentErrors()).toHaveLength(0);
    });
  });
});
