import { create } from 'zustand';
import type { GameState } from '../types/index.js';
import { AI_CONFIG } from './config.js';

let warnedAiDisableToggle = false;
function warnAiDisable(): void {
  if (warnedAiDisableToggle) return;
  warnedAiDisableToggle = true;
  try {
    globalThis.console?.warn?.('AI v2 cannot be disabled; ignoring toggle request.');
  } catch {
    // ignore logging issues in non-browser runtimes
  }
}

/**
 * State interface for the UI store (Zustand).
 * Controls game pause, time scale, debug toggles, and UI visibility.
 */
export type UiState = {
  paused: boolean;
  timeScale: number; // 0.25x .. 4x typical
  // Postprocessing toggle (bloom/FXAA/etc.)
  postprocessingEnabled: boolean;
  togglePostprocessing: () => void;
  setPostprocessingEnabled: (v: boolean) => void;
  togglePause: () => void;
  setPaused: (p: boolean) => void;
  setTimeScale: (s: number) => void;
  aiV2Enabled: boolean;
  toggleAiV2: () => void;
  setAiV2Enabled: (v: boolean) => void;
  aiDebugEnabled: boolean;
  toggleAiDebug: () => void;
  setAiDebugEnabled: (v: boolean) => void;
  hudHealthBarsEnabled: boolean;
  toggleHudHealthBars: () => void;
  setHudHealthBarsEnabled: (v: boolean) => void;
  explosionDebugEnabled: boolean;
  toggleExplosionDebug: () => void;
  setExplosionDebugEnabled: (v: boolean) => void;
  perfMonitorEnabled: boolean;
  togglePerfMonitor: () => void;
  setPerfMonitorEnabled: (v: boolean) => void;
  perfMonitorPosition: { x: number; y: number };
  setPerfMonitorPosition: (position: { x: number; y: number }) => void;
  progressionPanelPosition: { x: number; y: number };
  setProgressionPanelPosition: (position: { x: number; y: number }) => void;
  progressionPanelEnabled: boolean;
  toggleProgressionPanel: () => void;
  setProgressionPanelEnabled: (v: boolean) => void;
  // AI Experiment flags (runtime overrides)
  aiVerticalEnabled: boolean | null; // null = use config default
  toggleAiVertical: () => void;
  setAiVerticalEnabled: (v: boolean | null) => void;
  aiEngagementBoostEnabled: boolean | null;
  toggleAiEngagementBoost: () => void;
  setAiEngagementBoostEnabled: (v: boolean | null) => void;
  aiTickRateExperimentEnabled: boolean | null;
  toggleAiTickRateExperiment: () => void;
  setAiTickRateExperimentEnabled: (v: boolean | null) => void;
  aiRangePolicy: string | null; // null = use config default
  setAiRangePolicy: (v: string | null) => void;
  // New AI behaviour overrides (null = use config default)
  aiSmoothingEnabled?: boolean | null;
  toggleAiSmoothing?: () => void;
  setAiSmoothingEnabled?: (v: boolean | null) => void;
  aiHysteresisEnabled?: boolean | null;
  toggleAiHysteresis?: () => void;
  setAiHysteresisEnabled?: (v: boolean | null) => void;
  aiVerticalDampingEnabled?: boolean | null;
  toggleAiVerticalDamping?: () => void;
  setAiVerticalDampingEnabled?: (v: boolean | null) => void;
  /** Runtime control for per-subsystem profiling. */
  simProfileSubsystems: boolean;
  /** Toggle for runtime profiling. */
  toggleSimProfileSubsystems: () => void;
  /** Set profiler enable for UI store. */
  setSimProfileSubsystems: (v: boolean) => void;
  /** Sample rate used when profiling is enabled (every Nth tick). */
  simProfileSampleRate: number;
  /** Set the sampling rate for subsystem profiling. */
  setSimProfileSampleRate: (value: number) => void;
  /** Enable defensive subsystem guards at runtime. */
  simEnableSubsystemGuards: boolean;
  /** Toggle subsystem guard usage. */
  toggleSimEnableSubsystemGuards: () => void;
  /** Set the guard flag explicitly. */
  setSimEnableSubsystemGuards: (value: boolean) => void;
};

/**
 * Zustand store hook for accessing and modifying UI state.
 */
export const useUiStore = create<UiState>((set) => ({
  paused: false,
  timeScale: 1,
  postprocessingEnabled: true,
  togglePostprocessing: () => set((s) => ({ postprocessingEnabled: !s.postprocessingEnabled })),
  setPostprocessingEnabled: (v: boolean) => set({ postprocessingEnabled: v }),
  togglePause: () => set((s) => ({ paused: !s.paused })),
  setPaused: (p: boolean) => set({ paused: p }),
  setTimeScale: (s: number) => set({ timeScale: Math.max(0, s) }),
  aiV2Enabled: AI_CONFIG.v2Enabled,
  toggleAiV2: () =>
    set((s) => {
      if (s.aiV2Enabled) {
        warnAiDisable();
        return { aiV2Enabled: true };
      }
      return { aiV2Enabled: true };
    }),
  setAiV2Enabled: (v: boolean) =>
    set(() => {
      if (!v) {
        warnAiDisable();
        return { aiV2Enabled: true };
      }
      return { aiV2Enabled: true };
    }),
  aiDebugEnabled: false,
  toggleAiDebug: () => set((s) => ({ aiDebugEnabled: !s.aiDebugEnabled })),
  setAiDebugEnabled: (v: boolean) => set({ aiDebugEnabled: v }),
  hudHealthBarsEnabled: false,
  toggleHudHealthBars: () => set((s) => ({ hudHealthBarsEnabled: !s.hudHealthBarsEnabled })),
  setHudHealthBarsEnabled: (v: boolean) => set({ hudHealthBarsEnabled: v }),
  explosionDebugEnabled: false,
  toggleExplosionDebug: () => set((s) => ({ explosionDebugEnabled: !s.explosionDebugEnabled })),
  setExplosionDebugEnabled: (v: boolean) => set({ explosionDebugEnabled: v }),
  perfMonitorEnabled: false,
  togglePerfMonitor: () => set((s) => ({ perfMonitorEnabled: !s.perfMonitorEnabled })),
  setPerfMonitorEnabled: (v: boolean) => set({ perfMonitorEnabled: v }),
  perfMonitorPosition: { x: 16, y: 16 },
  setPerfMonitorPosition: (position: { x: number; y: number }) =>
    set({ perfMonitorPosition: { x: position.x, y: position.y } }),
  progressionPanelPosition: { x: 16, y: 120 },
  setProgressionPanelPosition: (position: { x: number; y: number }) =>
    set({ progressionPanelPosition: { x: position.x, y: position.y } }),
  progressionPanelEnabled: false,
  toggleProgressionPanel: () =>
    set((s) => ({ progressionPanelEnabled: !s.progressionPanelEnabled })),
  setProgressionPanelEnabled: (v: boolean) => set({ progressionPanelEnabled: v }),
  // AI Experiment flags (runtime overrides) - null means use config default
  aiVerticalEnabled: null,
  toggleAiVertical: () =>
    set((s) => ({
      aiVerticalEnabled:
        s.aiVerticalEnabled === null ? !AI_CONFIG.verticalEnabled : !s.aiVerticalEnabled,
    })),
  setAiVerticalEnabled: (v: boolean | null) => set({ aiVerticalEnabled: v }),
  aiEngagementBoostEnabled: null,
  toggleAiEngagementBoost: () =>
    set((s) => ({
      aiEngagementBoostEnabled:
        s.aiEngagementBoostEnabled === null
          ? !AI_CONFIG.engagementBoostEnabled
          : !s.aiEngagementBoostEnabled,
    })),
  setAiEngagementBoostEnabled: (v: boolean | null) => set({ aiEngagementBoostEnabled: v }),
  aiTickRateExperimentEnabled: null,
  toggleAiTickRateExperiment: () =>
    set((s) => ({
      aiTickRateExperimentEnabled:
        s.aiTickRateExperimentEnabled === null
          ? !AI_CONFIG.tickRateHzExperiment
          : !s.aiTickRateExperimentEnabled,
    })),
  setAiTickRateExperimentEnabled: (v: boolean | null) => set({ aiTickRateExperimentEnabled: v }),
  aiRangePolicy: null,
  setAiRangePolicy: (v: string | null) => set({ aiRangePolicy: v }),
  // New AI behaviour overrides
  aiSmoothingEnabled: null,
  toggleAiSmoothing: () =>
    set((s) => ({
      aiSmoothingEnabled:
        s.aiSmoothingEnabled === null ? !AI_CONFIG.smoothingEnabled : !s.aiSmoothingEnabled,
    })),
  setAiSmoothingEnabled: (v: boolean | null) => set({ aiSmoothingEnabled: v }),
  aiHysteresisEnabled: null,
  toggleAiHysteresis: () =>
    set((s) => ({
      aiHysteresisEnabled:
        s.aiHysteresisEnabled === null ? !AI_CONFIG.hysteresisEnabled : !s.aiHysteresisEnabled,
    })),
  setAiHysteresisEnabled: (v: boolean | null) => set({ aiHysteresisEnabled: v }),
  aiVerticalDampingEnabled: null,
  toggleAiVerticalDamping: () =>
    set((s) => ({
      aiVerticalDampingEnabled:
        s.aiVerticalDampingEnabled === null
          ? !AI_CONFIG.verticalDampingEnabled
          : !s.aiVerticalDampingEnabled,
    })),
  setAiVerticalDampingEnabled: (v: boolean | null) => set({ aiVerticalDampingEnabled: v }),
  simProfileSubsystems: false,
  toggleSimProfileSubsystems: () => set((s) => ({ simProfileSubsystems: !s.simProfileSubsystems })),
  setSimProfileSubsystems: (v: boolean) => set({ simProfileSubsystems: v }),
  simProfileSampleRate: 1,
  setSimProfileSampleRate: (value: number) =>
    set({ simProfileSampleRate: Math.max(1, Math.floor(value) || 1) }),
  simEnableSubsystemGuards: true,
  toggleSimEnableSubsystemGuards: () =>
    set((s) => ({ simEnableSubsystemGuards: !s.simEnableSubsystemGuards })),
  setSimEnableSubsystemGuards: (value: boolean) => set({ simEnableSubsystemGuards: value }),
}));

const globalWithUiStore = globalThis as { __spaceAutobattlerUiStore?: unknown };
if (typeof globalThis !== 'undefined') {
  globalWithUiStore.__spaceAutobattlerUiStore = useUiStore;
}

/**
 * Mirrors the HUD health bars flag from the UI store to the game state.
 * Ensures deterministic playback when replaying game states (if implemented).
 *
 * @param {GameState | null} state - The current game state.
 * @param {boolean} enabled - Whether health bars should be enabled.
 */
export function mirrorHudHealthBarsFlag(state: GameState | null, enabled: boolean): void {
  if (!state) return;
  if (!state.uiFlags) {
    state.uiFlags = { hudHealthBars: enabled };
    return;
  }
  state.uiFlags.hudHealthBars = enabled;
}
