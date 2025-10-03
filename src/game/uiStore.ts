import { create } from 'zustand';
import type { GameState } from '../types/index.js';
import { AI_CONFIG } from './config.js';

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
};

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
  toggleAiV2: () => set((s) => ({ aiV2Enabled: !s.aiV2Enabled })),
  setAiV2Enabled: (v: boolean) => set({ aiV2Enabled: v }),
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
  toggleProgressionPanel: () => set((s) => ({ progressionPanelEnabled: !s.progressionPanelEnabled })),
  setProgressionPanelEnabled: (v: boolean) => set({ progressionPanelEnabled: v }),
  // AI Experiment flags (runtime overrides) - null means use config default
  aiVerticalEnabled: null,
  toggleAiVertical: () => set((s) => ({ 
    aiVerticalEnabled: s.aiVerticalEnabled === null 
      ? !AI_CONFIG.verticalEnabled 
      : !s.aiVerticalEnabled 
  })),
  setAiVerticalEnabled: (v: boolean | null) => set({ aiVerticalEnabled: v }),
  aiEngagementBoostEnabled: null,
  toggleAiEngagementBoost: () => set((s) => ({ 
    aiEngagementBoostEnabled: s.aiEngagementBoostEnabled === null 
      ? !AI_CONFIG.engagementBoostEnabled 
      : !s.aiEngagementBoostEnabled 
  })),
  setAiEngagementBoostEnabled: (v: boolean | null) => set({ aiEngagementBoostEnabled: v }),
  aiTickRateExperimentEnabled: null,
  toggleAiTickRateExperiment: () => set((s) => ({ 
    aiTickRateExperimentEnabled: s.aiTickRateExperimentEnabled === null 
      ? !AI_CONFIG.tickRateHzExperiment 
      : !s.aiTickRateExperimentEnabled 
  })),
  setAiTickRateExperimentEnabled: (v: boolean | null) => set({ aiTickRateExperimentEnabled: v }),
  aiRangePolicy: null,
  setAiRangePolicy: (v: string | null) => set({ aiRangePolicy: v }),
}));

const globalWithUiStore = globalThis as { __spaceAutobattlerUiStore?: unknown };
if (typeof globalThis !== 'undefined') {
  globalWithUiStore.__spaceAutobattlerUiStore = useUiStore;
}

export function mirrorHudHealthBarsFlag(state: GameState | null, enabled: boolean): void {
  if (!state) return;
  if (!state.uiFlags) {
    state.uiFlags = { hudHealthBars: enabled };
    return;
  }
  state.uiFlags.hudHealthBars = enabled;
}

