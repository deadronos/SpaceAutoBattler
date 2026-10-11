import { describe, expect, it, beforeEach, afterEach, vi } from 'vite-plus/test';
import {
  registerDebugHook,
  hasDebugHook,
  getDebugHook,
  getRegisteredDebugKeys,
  clearDebugHooks,
  unregisterDebugHook,
  isCopilotDebugRegistryEnabled,
  __resetDebugRegistryForTests,
} from '../../src/debug/copilotDebugRegistry.js';

const KEY_A = '__copilot_test_a';
const KEY_B = '__copilot_test_b';

function deleteWindowKey(key: string): void {
  delete (window as unknown as Record<string, unknown>)[key];
}

describe('copilotDebugRegistry', () => {
  beforeEach(() => {
    __resetDebugRegistryForTests();
    deleteWindowKey(KEY_A);
    deleteWindowKey(KEY_B);
  });

  afterEach(() => {
    clearDebugHooks();
    __resetDebugRegistryForTests();
    vi.restoreAllMocks();
  });

  it('is enabled in dev/test builds', () => {
    expect(isCopilotDebugRegistryEnabled()).toBe(true);
  });

  it('registers a hook and exposes it on window', () => {
    const result = registerDebugHook(KEY_A, 42, 'alpha');

    expect(result).toBe(42);
    expect(hasDebugHook(KEY_A)).toBe(true);
    expect(getDebugHook<number>(KEY_A)).toBe(42);
    expect(getRegisteredDebugKeys()).toContain(KEY_A);
  });

  it('clears only the requested owner', () => {
    registerDebugHook(KEY_A, 'a', 'alpha');
    registerDebugHook(KEY_B, 'b', 'beta');

    clearDebugHooks('alpha');

    expect(hasDebugHook(KEY_A)).toBe(false);
    expect(hasDebugHook(KEY_B)).toBe(true);
    expect(getRegisteredDebugKeys()).toEqual([KEY_B]);
  });

  it('clears every owner when none is specified', () => {
    registerDebugHook(KEY_A, 'a', 'alpha');
    registerDebugHook(KEY_B, 'b', 'beta');

    clearDebugHooks();

    expect(hasDebugHook(KEY_A)).toBe(false);
    expect(hasDebugHook(KEY_B)).toBe(false);
    expect(getRegisteredDebugKeys()).toEqual([]);
  });

  it('unregisters without deleting the window value', () => {
    registerDebugHook(KEY_A, 'value', 'alpha');

    unregisterDebugHook(KEY_A);

    expect(getRegisteredDebugKeys()).not.toContain(KEY_A);
    expect(hasDebugHook(KEY_A)).toBe(true);
    expect(getDebugHook<string>(KEY_A)).toBe('value');
  });
});
