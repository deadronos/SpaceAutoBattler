import { describe, it, expect, beforeEach } from 'vitest';
import { useUIStore, selectDebugState, selectEntitySelection, selectPerformanceMetrics } from '../../src/ui/uiStore.js';

describe('UIStore (Zustand)', () => {
  beforeEach(() => {
    // Reset store state between tests to ensure isolation
    useUIStore.getState().resetUIState();
  });
  describe('Initialization', () => {
    it('should initialize with default values', () => {
      const store = useUIStore.getState();
      
      expect(store.debugMode).toBe(false);
      expect(store.showSpatialGrid).toBe(false);
      expect(store.selectedEntityId).toBe(null);
      expect(store.averageFrameTime).toBe(16.67);
      expect(store.entityIndexQueryCount).toBe(0);
    });
  });

  describe('Debug Controls', () => {
    it('should toggle debug modes correctly', () => {
      const { setDebugMode, toggleSpatialGrid, toggleEntityIndexStats } = useUIStore.getState();
      
      // Set debug mode
      setDebugMode(true);
      expect(useUIStore.getState().debugMode).toBe(true);
      
      // Toggle spatial grid
      toggleSpatialGrid();
      expect(useUIStore.getState().showSpatialGrid).toBe(true);
      
      toggleSpatialGrid();
      expect(useUIStore.getState().showSpatialGrid).toBe(false);
      
      // Toggle entity index stats
      toggleEntityIndexStats();
      expect(useUIStore.getState().showEntityIndexStats).toBe(true);
    });
  });

  describe('Entity Selection', () => {
    it('should manage entity selection state', () => {
      const { selectEntity, setHoveredEntity } = useUIStore.getState();
      
      // Select entity
      selectEntity(123);
      expect(useUIStore.getState().selectedEntityId).toBe(123);
      
      // Hover entity
      setHoveredEntity(456);
      expect(useUIStore.getState().hoveredEntityId).toBe(456);
      
      // Clear selection
      selectEntity(null);
      expect(useUIStore.getState().selectedEntityId).toBe(null);
    });
  });

  describe('Performance Monitoring', () => {
    it('should track frame time with exponential moving average', () => {
      const { updateFrameTime } = useUIStore.getState();
      
      // Initial state
      expect(useUIStore.getState().averageFrameTime).toBe(16.67);
      
      // Update with new frame time
      updateFrameTime(20.0);
      const firstAverage = useUIStore.getState().averageFrameTime;
      expect(firstAverage).toBeGreaterThan(16.67);
      expect(firstAverage).toBeLessThan(20.0); // Should be weighted average
      
      // Update again
      updateFrameTime(30.0);
      const secondAverage = useUIStore.getState().averageFrameTime;
      expect(secondAverage).toBeGreaterThan(firstAverage);
    });

    it('should track entity index query count', () => {
      const { incrementQueryCount, resetQueryCount } = useUIStore.getState();
      
      // Initial count
      expect(useUIStore.getState().entityIndexQueryCount).toBe(0);
      
      // Increment
      incrementQueryCount();
      incrementQueryCount();
      expect(useUIStore.getState().entityIndexQueryCount).toBe(2);
      
      // Reset
      resetQueryCount();
      expect(useUIStore.getState().entityIndexQueryCount).toBe(0);
    });
  });

  describe('Panel Management', () => {
    it('should toggle UI panels', () => {
      const { toggleEntityInspector, toggleSystemsPanel } = useUIStore.getState();
      
      // Initially hidden
      expect(useUIStore.getState().showEntityInspector).toBe(false);
      expect(useUIStore.getState().showSystemsPanel).toBe(false);
      
      // Toggle panels
      toggleEntityInspector();
      expect(useUIStore.getState().showEntityInspector).toBe(true);
      
      toggleSystemsPanel();
      expect(useUIStore.getState().showSystemsPanel).toBe(true);
    });
  });

  describe('Camera Controls', () => {
    it('should manage camera preferences', () => {
      const { setFollowSelectedEntity, toggleCameraAutoRotate } = useUIStore.getState();
      
      // Set follow mode
      setFollowSelectedEntity(true);
      expect(useUIStore.getState().followSelectedEntity).toBe(true);
      
      // Toggle auto rotate
      toggleCameraAutoRotate();
      expect(useUIStore.getState().cameraAutoRotate).toBe(true);
      
      toggleCameraAutoRotate();
      expect(useUIStore.getState().cameraAutoRotate).toBe(false);
    });
  });

  describe('Selectors', () => {
    it('should provide debug state selector', () => {
      const store = useUIStore.getState();
      
      store.setDebugMode(true);
      store.toggleSpatialGrid();
      
      // Get fresh state after changes
      const currentState = useUIStore.getState();
      const debugState = selectDebugState(currentState);
      expect(debugState).toEqual({
        debugMode: true,
        showSpatialGrid: true,
        showEntityIndexStats: false,
        showPerformanceOverlay: false,
      });
    });

    it('should provide entity selection selector', () => {
      const store = useUIStore.getState();
      
      store.selectEntity(789);
      store.setFollowSelectedEntity(true);
      
      // Get fresh state after changes
      const currentState = useUIStore.getState();
      const selectionState = selectEntitySelection(currentState);
      expect(selectionState).toEqual({
        selectedEntityId: 789,
        hoveredEntityId: null,
        followSelectedEntity: true,
      });
    });

    it('should provide performance metrics selector', () => {
      const { updateFrameTime, incrementQueryCount } = useUIStore.getState();
      
      updateFrameTime(25.0);
      incrementQueryCount();
      
      const metrics = selectPerformanceMetrics(useUIStore.getState());
      expect(metrics.lastFrameTime).toBe(25.0);
      expect(metrics.entityIndexQueryCount).toBe(1);
      expect(metrics.averageFrameTime).toBeGreaterThan(16.67);
    });
  });

  describe('Reset Functionality', () => {
    it('should reset all UI state to defaults', () => {
      const store = useUIStore.getState();
      
      // Modify state
      store.setDebugMode(true);
      store.selectEntity(999);
      store.incrementQueryCount();
      store.toggleEntityInspector();
      
      // Get current state to verify changes
      let currentState = useUIStore.getState();
      expect(currentState.debugMode).toBe(true);
      expect(currentState.selectedEntityId).toBe(999);
      expect(currentState.entityIndexQueryCount).toBe(1);
      expect(currentState.showEntityInspector).toBe(true);
      
      // Reset
      store.resetUIState();
      
      // Verify reset to defaults
      currentState = useUIStore.getState();
      expect(currentState.debugMode).toBe(false);
      expect(currentState.selectedEntityId).toBe(null);
      expect(currentState.entityIndexQueryCount).toBe(0);
      expect(currentState.showEntityInspector).toBe(false);
    });
  });
});