import { create } from 'zustand';

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
}));
