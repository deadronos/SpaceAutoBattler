// Lightweight logger utility with configurable levels.
// Debug messages require both DEBUG flag and appropriate log level.

import { hasProcess, envVar } from './env.js';

export let DEBUG_ENABLED =
  (typeof window !== 'undefined' &&
    (window as unknown as { __DEBUG__?: boolean }).__DEBUG__ === true) ||
  (hasProcess && envVar('DEBUG', '') === 'true');

export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'silent';
const levelOrder: Record<LogLevel, number> = { debug: 0, info: 1, warn: 2, error: 3, silent: 4 };
let currentLevel: LogLevel = 'info';

// Dynamic console wrapper that forwards to the current global console methods.
// This avoids capturing the console functions at module initialization so
// test-spies (which replace console.*) will still be observed.
const consoleLogger = {
  log: (...args: unknown[]) => console.log(...args),
  info: (...args: unknown[]) => console.info(...args),
  warn: (...args: unknown[]) => console.warn(...args),
  error: (...args: unknown[]) => console.error(...args),
};

export function setDebug(v: boolean) {
  DEBUG_ENABLED = !!v;
  if (typeof window !== 'undefined') (window as unknown as { __DEBUG__?: boolean }).__DEBUG__ = !!v;
}

export function setLevel(level: LogLevel) {
  currentLevel = level;
}

function shouldLog(level: LogLevel): boolean {
  return levelOrder[level] >= levelOrder[currentLevel];
}

export function debug(...args: unknown[]) {
  if (!DEBUG_ENABLED || !shouldLog('debug')) return;
  // Keep debug prints identifiable in log output
  consoleLogger.log(...args);
}

// Accept a thunk so callers can avoid any formatting/allocations when debug is disabled.
export function debugLazy(fn: () => unknown | unknown[]) {
  if (!DEBUG_ENABLED || !shouldLog('debug')) return;
  let res: unknown = undefined;
  try {
    res = fn();
  } catch (e) {
    // If the thunk throws, surface the error as a warn but avoid crashing.
    consoleLogger.warn('[logger] debugLazy thunk threw', e);
    return;
  }
  if (Array.isArray(res)) {
    consoleLogger.log(...(res as unknown[]));
  } else {
    consoleLogger.log(res);
  }
}

// Conditional lazy debug that checks an additional condition (like DEBUG_AI)
export function debugIf(cond: boolean, fn: () => unknown | unknown[]) {
  if (!cond) return;
  debugLazy(fn);
}

export function info(...args: unknown[]) {
  if (!shouldLog('info')) return;
  consoleLogger.info(...args);
}

export function warn(...args: unknown[]) {
  if (!shouldLog('warn')) return;
  consoleLogger.warn(...args);
}

export function error(...args: unknown[]) {
  if (!shouldLog('error')) return;
  consoleLogger.error(...args);
}

export default { debug, debugLazy, debugIf, info, warn, error, setDebug, setLevel };
