// Safe environment helpers for code that runs both in Node and the browser.
// Avoid directly referencing `process` in top-level expressions which can
// cause `ReferenceError: process is not defined` when bundled for browsers.
export const hasProcess = typeof process !== 'undefined' && typeof process.env !== 'undefined';
export const DEBUG = hasProcess && (process.env.DEBUG === 'true' || process.env.DEBUG === '1');
// DEBUG_AI is false by default. It can be enabled via:
//  - Node env var: DEBUG_AI=1 or DEBUG_AI=true
//  - Browser URL param: ?debugAI=1
export const DEBUG_AI = (() => {
  try {
    if (hasProcess) {
      const v = process.env.DEBUG_AI;
      if (v === '1' || v === 'true') return true;
      if (v === '0' || v === 'false') return false;
    }
    // Browser fallback: look for ?debugAI=1 in the URL
    if (typeof location !== 'undefined' && typeof URLSearchParams !== 'undefined') {
      const params = new URLSearchParams(location.search || '');
      return params.get('debugAI') === '1' || params.get('debugAI') === 'true';
    }
  } catch {
    // Ignore errors and default to false
  }
  return false;
})();

export function envVar(name: string, fallback?: string): string | undefined {
  if (!hasProcess) return fallback;
  return process.env[name] ?? fallback;
}
