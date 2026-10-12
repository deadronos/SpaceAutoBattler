import { registerDebugHook, unregisterDebugHook } from '../../../debug/copilotDebugRegistry.js';
import { getStarDebugWindow } from '../../../debug/starDebugWindow.js';

export { getStarDebugWindow };
export type { StarDebugWindow } from '../../../debug/starDebugWindow.js';

const updateLocalStorageTimestamp = (key: string): void => {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(key, String(Date.now()));
    }
  } catch {
    // Ignore storage failures in dev helpers
  }
};

export const markCompileAttempt = (): void => {
  const win = getStarDebugWindow();
  if (!win) return;
  (win as { __STAR_COMPILE_ATTEMPTED?: string }).__STAR_COMPILE_ATTEMPTED = String(Date.now());
  win.__STAR_COMPILED = true;
  updateLocalStorageTimestamp('copilot_star_compiled');
};

export const markCompileComplete = (): void => {
  const win = getStarDebugWindow();
  if (!win) return;
  win.__STAR_COMPILED = true;
  updateLocalStorageTimestamp('copilot_star_compiled');
};

export const registerPollerCleanup = (dispose: () => void): void => {
  const win = getStarDebugWindow();
  if (!win) return;
  (win.__copilot_star_compile_dispose ||= []).push(dispose);
};

export const pushGlLogEntry = (entry: unknown): void => {
  const win = getStarDebugWindow();
  if (!win || !win.__copilot_glLogs) return;
  try {
    win.__copilot_glLogs.push(entry);
  } catch {
    // ignore
  }
};

export const isForceOpaqueEnabled = (): boolean => {
  const win = getStarDebugWindow();
  return Boolean(win?.__copilot_forceStarOpaque);
};

export const markForceOpaqueApplied = (): void => {
  const win = getStarDebugWindow();
  if (!win) return;
  win.__copilot_star_forcedOpaque = true;
};

export const getForceOnTopFlag = (): boolean | undefined => {
  const win = getStarDebugWindow();
  return win?.__copilot_star_forceOnTop;
};

export const setForceOnTopFlag = (enabled: boolean | undefined): void => {
  const win = getStarDebugWindow();
  if (!win) return;
  if (enabled == null) {
    delete win.__copilot_star_forceOnTop;
    unregisterDebugHook('__copilot_star_forceOnTop');
  } else {
    registerDebugHook('__copilot_star_forceOnTop', enabled, 'star');
  }
};
