import { reportConfigError } from './errorReporting.js';

const TRUE_VALUES = new Set(['1', 'true', 'on']);

/**
 * Reads a raw URL query parameter, or null when unavailable/absent.
 *
 * @param {string} name - Parameter name.
 * @returns {string | null}
 */
export function readQueryParam(name: string): string | null {
  try {
    if (typeof window !== 'undefined' && window.location) {
      return new URLSearchParams(window.location.search).get(name);
    }
  } catch (error) {
    reportConfigError(name, error);
  }
  return null;
}

/**
 * Reads a boolean query parameter (`1`/`true`/`on`); returns `defaultValue`
 * when absent.
 *
 * @param {string} name - Parameter name.
 * @param {boolean} [defaultValue=false] - Value when the parameter is absent.
 * @returns {boolean}
 */
export function readBooleanParam(name: string, defaultValue = false): boolean {
  const raw = readQueryParam(name);
  if (raw === null) return defaultValue;
  return TRUE_VALUES.has(raw.toLowerCase());
}

/**
 * Reads a string query parameter; returns `defaultValue` when absent.
 *
 * @param {string} name - Parameter name.
 * @param {string} defaultValue - Value when the parameter is absent.
 * @returns {string}
 */
export function readStringParam(name: string, defaultValue: string): string {
  return readQueryParam(name) ?? defaultValue;
}

/**
 * Reads a numeric query parameter; returns `defaultValue` when absent/invalid.
 *
 * @param {string} name - Parameter name.
 * @param {number} defaultValue - Value when the parameter is absent/invalid.
 * @returns {number}
 */
export function readNumberParam(name: string, defaultValue: number): number {
  const raw = readQueryParam(name);
  if (raw === null) return defaultValue;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : defaultValue;
}
