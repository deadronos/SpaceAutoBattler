import { SpatialGrid } from '../../../src/utils/spatialGrid.js';
import type { GameState } from '../../../src/types/index.js';

/**
 * Populate or rebuild the spatial grid for a GameState in tests.
 * If the state already has a grid, it will be rebuilt from state.ships.
 * If it doesn't, a new grid will be created and assigned to state.spatialGrid.
 */
export function populateSpatialGridForTest(state: GameState) {
  const bounds = state?.simConfig?.simBounds ?? { width: 1920, height: 1080, depth: 600 };
  if (!state.spatialGrid) state.spatialGrid = new SpatialGrid(64, bounds);
  state.spatialGrid.rebuild(state.ships.map(s => ({ id: s.id, pos: s.pos, radius: 16, team: s.team })));
}

export default populateSpatialGridForTest;
