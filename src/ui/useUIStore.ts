import create from 'zustand';

export type UIState = {
  showSpatialGrid: boolean;
  selectedEntityId: number | null;
  debugMode: boolean;
  toggleSpatialGrid: () => void;
  setSelectedEntity: (id: number | null) => void;
  toggleDebug: () => void;
};

export const useUIStore = create<UIState>((set) => ({
  showSpatialGrid: false,
  selectedEntityId: null,
  debugMode: false,
  toggleSpatialGrid: () => set((s) => ({ showSpatialGrid: !s.showSpatialGrid })),
  setSelectedEntity: (id) => set(() => ({ selectedEntityId: id })),
  toggleDebug: () => set((s) => ({ debugMode: !s.debugMode })),
}));
