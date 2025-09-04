// Lightweight logger utility with configurable levels.
// Debug messages require both DEBUG flag and appropriate log level.

import { hasProcess, envVar } from './env';

export let DEBUG_ENABLED = (typeof window !== 'undefined' && (window as unknown as { __DEBUG__?: boolean }).__DEBUG__ === true) ||
  (hasProcess && envVar('DEBUG', '') === 'true');

export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'silent';
const levelOrder: Record<LogLevel, number> = { debug: 0, info: 1, warn: 2, error: 3, silent: 4 };
let currentLevel: LogLevel = 'info';

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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- safe call to console with unknown args
  console.log(...(args as any));
}

export function info(...args: unknown[]) {
  if (!shouldLog('info')) return;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- safe call to console
  console.info(...(args as any));
}

export function warn(...args: unknown[]) {
  if (!shouldLog('warn')) return;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- safe call to console
  console.warn(...(args as any));
}

export function error(...args: unknown[]) {
  if (!shouldLog('error')) return;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- safe call to console
  console.error(...(args as any));
}

export default { debug, info, warn, error, setDebug, setLevel };

