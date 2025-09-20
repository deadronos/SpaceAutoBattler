import { create } from 'zustand';

type UiState = {
  paused: boolean;
  timeScale: number; // 0.25x .. 4x typical
  togglePause: () => void;
  setPaused: (p: boolean) => void;
  setTimeScale: (s: number) => void;
};

export const useUiStore = create<UiState>((set) => ({
  paused: false,
  timeScale: 1,
  togglePause: () => set((s) => ({ paused: !s.paused })),
  setPaused: (p: boolean) => set({ paused: p }),
  setTimeScale: (s: number) => set({ timeScale: Math.max(0, s) }),
}));
