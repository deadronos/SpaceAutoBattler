/**
 * Dev-only Copilot debug hook registry.
 *
 * Centralises the `window.__copilot_*` scaffolding that render components
 * expose for interactive debugging and E2E tests. Hooks are tracked per owner
 * so cleanup can be scoped to a component, and registration is gated behind
 * `import.meta.env.DEV` / `isCopilotDebugEnabled()` so production builds that
 * are not explicitly in debug mode do not install hooks.
 *
 * The registry is intentionally tiny and framework-agnostic: components call
 * `registerDebugHook(...)` when they would otherwise assign `window.__copilot_*`
 * directly, and call `clearDebugHooks(owner)` from their cleanup.
 */

import { isCopilotDebugEnabled } from '../utils/copilotDebug.js';

/** Identifies the component that owns a set of debug hooks. */
export type DebugHookOwner = string;

const registered = new Map<string, DebugHookOwner>();

/**
 * Whether the debug registry should install hooks.
 *
 * True in dev builds, or in any build when Copilot debug mode is explicitly
 * enabled (e.g. `?copilot_debug=1`). The runtime check is required because the
 * E2E suite exercises the production bundle with the debug flag set.
 *
 * @returns {boolean} True when debug hooks may be registered.
 */
export function isCopilotDebugRegistryEnabled(): boolean {
  return import.meta.env.DEV || isCopilotDebugEnabled();
}

function getWindow(): Record<string, unknown> | undefined {
  return typeof window === 'undefined' ? undefined : (window as unknown as Record<string, unknown>);
}

/**
 * Register a debug hook on `window` and track it for later cleanup.
 *
 * @param {string} key - The `window` property name (e.g. `__copilot_setStarLayer`).
 * @param {T} value - The value to assign.
 * @param {DebugHookOwner} [owner='default'] - Owner used for scoped cleanup.
 * @returns {T | undefined} The registered value, or undefined when disabled.
 */
export function registerDebugHook<T>(
  key: string,
  value: T,
  owner: DebugHookOwner = 'default',
): T | undefined {
  if (!isCopilotDebugRegistryEnabled()) {
    return undefined;
  }
  const win = getWindow();
  if (!win) {
    return undefined;
  }
  win[key] = value;
  registered.set(key, owner);
  return value;
}

/**
 * Stop tracking a hook without deleting it from `window`.
 *
 * @param {string} key - The `window` property name to forget.
 */
export function unregisterDebugHook(key: string): void {
  registered.delete(key);
}

/** Whether a hook is present on `window` (registered or set directly). */
export function hasDebugHook(key: string): boolean {
  const win = getWindow();
  return Boolean(win && key in win);
}

/** Read a debug hook value from `window`. */
export function getDebugHook<T>(key: string): T | undefined {
  const win = getWindow();
  return win ? (win[key] as T | undefined) : undefined;
}

/** The keys currently tracked by the registry (diagnostics/tests). */
export function getRegisteredDebugKeys(): string[] {
  return Array.from(registered.keys());
}

/**
 * Delete tracked debug hooks, optionally scoped to a single owner.
 *
 * @param {DebugHookOwner} [owner] - When provided, only that owner's hooks are cleared.
 */
export function clearDebugHooks(owner?: DebugHookOwner): void {
  const win = getWindow();
  if (!win) {
    return;
  }
  for (const key of Array.from(registered.keys())) {
    const entryOwner = registered.get(key);
    if (owner && entryOwner !== owner) {
      continue;
    }
    if (key in win) {
      try {
        delete win[key];
      } catch {
        win[key] = undefined;
      }
    }
    registered.delete(key);
  }
}

/** Test-only: forget all tracked keys without touching `window`. */
export function __resetDebugRegistryForTests(): void {
  registered.clear();
}
