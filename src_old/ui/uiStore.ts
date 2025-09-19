/**
 * Zustand store for UI state management.
 * Keeps transient UI state separate from simulation GameState.
 */
import { create } from 'zustand';
import type { EntityId } from '../types/index.js';

export interface UIState {
  // Debug toggles
  debugMode: boolean;
  showSpatialGrid: boolean;
  showEntityIndexStats: boolean;
  showPerformanceOverlay: boolean;
  
  // Entity selection and inspection
  selectedEntityId: EntityId | null;
  hoveredEntityId: EntityId | null;
  
  // UI panel states
  showEntityInspector: boolean;
  showSystemsPanel: boolean;
  
  // Performance monitoring
  lastFrameTime: number;
  averageFrameTime: number;
  entityIndexQueryCount: number;
  
  // Camera preferences
  followSelectedEntity: boolean;
  cameraAutoRotate: boolean;
}

export interface UIActions {
  // Debug toggles
  setDebugMode: (enabled: boolean) => void;
  toggleSpatialGrid: () => void;
  toggleEntityIndexStats: () => void;
  togglePerformanceOverlay: () => void;
  
  // Entity selection
  selectEntity: (id: EntityId | null) => void;
  setHoveredEntity: (id: EntityId | null) => void;
  
  // UI panels
  toggleEntityInspector: () => void;
  toggleSystemsPanel: () => void;
  
  // Performance monitoring
  updateFrameTime: (frameTime: number) => void;
  incrementQueryCount: () => void;
  resetQueryCount: () => void;
  
  // Camera controls
  setFollowSelectedEntity: (follow: boolean) => void;
  toggleCameraAutoRotate: () => void;
  
  // Bulk operations
  resetUIState: () => void;
}

export type UIStore = UIState & UIActions;

const initialState: UIState = {
  debugMode: false,
  showSpatialGrid: false,
  showEntityIndexStats: false,
  showPerformanceOverlay: false,
  
  selectedEntityId: null,
  hoveredEntityId: null,
  
  showEntityInspector: false,
  showSystemsPanel: false,
  
  lastFrameTime: 0,
  averageFrameTime: 16.67, // 60 FPS baseline
  entityIndexQueryCount: 0,
  
  followSelectedEntity: false,
  cameraAutoRotate: false,
};

export const useUIStore = create<UIStore>((set, get) => ({
  ...initialState,
  
  // Debug toggles
  setDebugMode: (enabled: boolean) => set({ debugMode: enabled }),
  toggleSpatialGrid: () => set((state) => ({ showSpatialGrid: !state.showSpatialGrid })),
  toggleEntityIndexStats: () => set((state) => ({ showEntityIndexStats: !state.showEntityIndexStats })),
  togglePerformanceOverlay: () => set((state) => ({ showPerformanceOverlay: !state.showPerformanceOverlay })),
  
  // Entity selection
  selectEntity: (id: EntityId | null) => set({ selectedEntityId: id }),
  setHoveredEntity: (id: EntityId | null) => set({ hoveredEntityId: id }),
  
  // UI panels
  toggleEntityInspector: () => set((state) => ({ showEntityInspector: !state.showEntityInspector })),
  toggleSystemsPanel: () => set((state) => ({ showSystemsPanel: !state.showSystemsPanel })),
  
  // Performance monitoring
  updateFrameTime: (frameTime: number) => {
    const currentAverage = get().averageFrameTime;
    const newAverage = currentAverage * 0.9 + frameTime * 0.1; // Exponential moving average
    set({ lastFrameTime: frameTime, averageFrameTime: newAverage });
  },
  incrementQueryCount: () => set((state) => ({ entityIndexQueryCount: state.entityIndexQueryCount + 1 })),
  resetQueryCount: () => set({ entityIndexQueryCount: 0 }),
  
  // Camera controls
  setFollowSelectedEntity: (follow: boolean) => set({ followSelectedEntity: follow }),
  toggleCameraAutoRotate: () => set((state) => ({ cameraAutoRotate: !state.cameraAutoRotate })),
  
  // Bulk operations
  resetUIState: () => set(initialState),
}));

// Selectors for common use cases
export const selectDebugState = (state: UIStore) => ({
  debugMode: state.debugMode,
  showSpatialGrid: state.showSpatialGrid,
  showEntityIndexStats: state.showEntityIndexStats,
  showPerformanceOverlay: state.showPerformanceOverlay,
});

export const selectEntitySelection = (state: UIStore) => ({
  selectedEntityId: state.selectedEntityId,
  hoveredEntityId: state.hoveredEntityId,
  followSelectedEntity: state.followSelectedEntity,
});

export const selectPerformanceMetrics = (state: UIStore) => ({
  lastFrameTime: state.lastFrameTime,
  averageFrameTime: state.averageFrameTime,
  entityIndexQueryCount: state.entityIndexQueryCount,
});