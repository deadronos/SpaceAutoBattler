// Safe environment helpers for code that runs both in Node and the browser.
// Avoid directly referencing `process` in top-level expressions which can
// cause `ReferenceError: process is not defined` when bundled for browsers.
export const hasProcess = typeof process !== 'undefined' && typeof process.env !== 'undefined';
export const DEBUG = hasProcess && (process.env.DEBUG === 'true' || process.env.DEBUG === '1');
export const DEBUG_AI = hasProcess && !!process.env.DEBUG_AI;

export function envVar(name: string, fallback?: string): string | undefined {
  if (!hasProcess) return fallback;
  return process.env[name] ?? fallback;
}
