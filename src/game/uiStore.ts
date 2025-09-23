import { create } from 'zustand';
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
}));
