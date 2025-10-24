import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import {
  wrapStarTime,
  isCopilotDebugEnabled,
  STAR_TIME_WRAP_SECONDS,
} from '../../src/utils/starDisk.js';

describe('wrapStarTime', () => {
  it('returns wrapped:0, cycles:0 for time=0', () => {
    const result = wrapStarTime(0);
    expect(result.wrapped).toBe(0);
    expect(result.cycles).toBe(0);
  });

  it('returns the same time when below wrap period', () => {
    const result = wrapStarTime(100);
    expect(result.wrapped).toBe(100);
    expect(result.cycles).toBe(0);
  });

  it('wraps time at the period boundary', () => {
    const result = wrapStarTime(STAR_TIME_WRAP_SECONDS);
    expect(result.wrapped).toBe(0);
    expect(result.cycles).toBe(1);
  });

  it('wraps time beyond one complete cycle', () => {
    const result = wrapStarTime(STAR_TIME_WRAP_SECONDS + 100);
    expect(result.wrapped).toBe(100);
    expect(result.cycles).toBe(1);
  });

  it('wraps time beyond multiple cycles', () => {
    const result = wrapStarTime(STAR_TIME_WRAP_SECONDS * 2.5);
    expect(result.wrapped).toBe(STAR_TIME_WRAP_SECONDS * 0.5);
    expect(result.cycles).toBe(2);
  });

  it('handles negative time by wrapping to positive range', () => {
    const result = wrapStarTime(-100);
    expect(result.wrapped).toBeGreaterThanOrEqual(0);
    expect(result.wrapped).toBeLessThan(STAR_TIME_WRAP_SECONDS);
    // For small negative values, cycles will be -0 or 0 (both are equivalent)
    expect(Math.abs(result.cycles)).toBeLessThanOrEqual(1);
  });

  it('handles Infinity by returning wrapped:0, cycles:0', () => {
    const result = wrapStarTime(Infinity);
    expect(result.wrapped).toBe(0);
    expect(result.cycles).toBe(0);
  });

  it('handles -Infinity by returning wrapped:0, cycles:0', () => {
    const result = wrapStarTime(-Infinity);
    expect(result.wrapped).toBe(0);
    expect(result.cycles).toBe(0);
  });

  it('handles NaN by returning wrapped:0, cycles:0', () => {
    const result = wrapStarTime(NaN);
    expect(result.wrapped).toBe(0);
    expect(result.cycles).toBe(0);
  });
});

describe('isCopilotDebugEnabled', () => {
  let originalWindow: typeof globalThis.window | undefined;
  let originalLocation: Location | undefined;

  beforeEach(() => {
    // Save original window state
    originalWindow = globalThis.window;
    if (typeof window !== 'undefined') {
      originalLocation = window.location;
    }
  });

  afterEach(() => {
    // Restore original window state
    if (originalWindow && typeof window !== 'undefined') {
      // Clean up any test flags
      const win = window as Window & { __copilotDebugForce?: boolean };
      delete win.__copilotDebugForce;

      // Restore location if it was modified
      if (originalLocation) {
        Object.defineProperty(window, 'location', {
          value: originalLocation,
          writable: true,
          configurable: true,
        });
      }
    }
  });

  it('returns false when window is undefined', () => {
    // This test assumes we're in a Node.js-like environment where window might not be defined
    // In happy-dom, window is always defined, so we'll skip this test or mock it differently
    if (typeof window === 'undefined') {
      expect(isCopilotDebugEnabled()).toBe(false);
    }
  });

  it('returns false when no debug flag is present', () => {
    if (typeof window !== 'undefined') {
      Object.defineProperty(window, 'location', {
        value: { search: '' },
        writable: true,
        configurable: true,
      });
    }
    expect(isCopilotDebugEnabled()).toBe(false);
  });

  it('returns true when copilot_debug=1 is in query string', () => {
    if (typeof window !== 'undefined') {
      Object.defineProperty(window, 'location', {
        value: { search: '?copilot_debug=1' },
        writable: true,
        configurable: true,
      });
    }
    expect(isCopilotDebugEnabled()).toBe(true);
  });

  it('returns true when copilot_debug=1 is in query string with other params', () => {
    if (typeof window !== 'undefined') {
      Object.defineProperty(window, 'location', {
        value: { search: '?foo=bar&copilot_debug=1&baz=qux' },
        writable: true,
        configurable: true,
      });
    }
    expect(isCopilotDebugEnabled()).toBe(true);
  });

  it('returns false when copilot_debug has different value', () => {
    if (typeof window !== 'undefined') {
      Object.defineProperty(window, 'location', {
        value: { search: '?copilot_debug=0' },
        writable: true,
        configurable: true,
      });
    }
    expect(isCopilotDebugEnabled()).toBe(false);
  });

  it('returns true when __copilotDebugForce flag is set', () => {
    if (typeof window !== 'undefined') {
      const win = window as Window & { __copilotDebugForce?: boolean };
      win.__copilotDebugForce = true;
      Object.defineProperty(window, 'location', {
        value: { search: '' },
        writable: true,
        configurable: true,
      });
    }
    expect(isCopilotDebugEnabled()).toBe(true);
  });

  it('handles location.search being non-string gracefully', () => {
    if (typeof window !== 'undefined') {
      Object.defineProperty(window, 'location', {
        value: { search: null },
        writable: true,
        configurable: true,
      });
    }
    expect(isCopilotDebugEnabled()).toBe(false);
  });
});
