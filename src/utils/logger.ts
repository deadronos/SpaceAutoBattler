// Lightweight logger utility. Debug messages are no-ops unless enabled via
// window.__DEBUG__ === true or process.env.DEBUG === 'true'.
export let DEBUG_ENABLED = (typeof window !== 'undefined' && (window as unknown as { __DEBUG__?: boolean }).__DEBUG__ === true) ||
  (typeof process !== 'undefined' && process.env && process.env.DEBUG === 'true');

export function setDebug(v: boolean) {
  DEBUG_ENABLED = !!v;
  if (typeof window !== 'undefined') (window as unknown as { __DEBUG__?: boolean }).__DEBUG__ = !!v;
}

export function debug(...args: unknown[]) {
  if (!DEBUG_ENABLED) return;
  // Keep debug prints identifiable in log output
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- safe call to console with unknown args
  console.log(...(args as any));
}

export function info(...args: unknown[]) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- safe call to console
  console.info(...(args as any));
}

export function warn(...args: unknown[]) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- safe call to console
  console.warn(...(args as any));
}

export function error(...args: unknown[]) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- safe call to console
  console.error(...(args as any));
}

export default { debug, info, warn, error, setDebug };

