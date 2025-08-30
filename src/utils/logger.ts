// Lightweight logger utility. Debug messages are no-ops unless enabled via
// window.__DEBUG__ === true or process.env.DEBUG === 'true'.
export let DEBUG_ENABLED = (typeof window !== 'undefined' && (window as any).__DEBUG__ === true) ||
  (typeof process !== 'undefined' && process.env && process.env.DEBUG === 'true');

export function setDebug(v: boolean) {
  DEBUG_ENABLED = !!v;
  if (typeof window !== 'undefined') (window as any).__DEBUG__ = !!v;
}

export function debug(...args: any[]) {
  if (!DEBUG_ENABLED) return;
  // Keep debug prints identifiable in log output
  console.log(...args);
}

export function info(...args: any[]) {
  console.info(...args);
}

export function warn(...args: any[]) {
  console.warn(...args);
}

export function error(...args: any[]) {
  console.error(...args);
}

export default { debug, info, warn, error, setDebug };
