import { expect, test } from 'vitest';
import { createInitialState, resetState } from '../../src/core/gameState.js';

test('entityIndex is created when enableSpatialIndex is true on reset', () => {
  const state = createInitialState('entity-index-init');
  // Ensure flag is enabled
  state.behaviorConfig = state.behaviorConfig || ({} as any);
  state.behaviorConfig.globalSettings = state.behaviorConfig.globalSettings || ({} as any);
  state.behaviorConfig.globalSettings.enableSpatialIndex = true;
  // Call resetState which should initialize spatialGrid and entityIndex when enabled
  resetState(state, state.rng.seed);
  expect(state.spatialGrid).toBeDefined();
  expect(state.entityIndex).toBeDefined();
  // Basic sanity checks
  if (state.entityIndex) {
    expect(typeof state.entityIndex.queryNeighbors).toBe('function');
    expect(state.entityIndex.grid.bucketSize).toBeGreaterThan(0);
  }
});
