import { create } from 'zustand';
import type { GameState } from '../types/index.js';
import { AI_CONFIG } from './config.js';

type UiState = {
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
};

export const useUiStore = create<UiState>((set) => ({
  paused: false,
  timeScale: 1,
  postprocessingEnabled: false,
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
}));

export function mirrorHudHealthBarsFlag(state: GameState | null, enabled: boolean): void {
  if (!state) return;
  if (!state.uiFlags) {
    state.uiFlags = { hudHealthBars: enabled };
    return;
  }
  state.uiFlags.hudHealthBars = enabled;
}
