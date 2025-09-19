import { describe, it, expect } from 'vitest';
import { AggressiveSpatialOptimizer } from '../../src/core/ai/aggressiveSpatialOptimizer.js';
import type { Vector3 } from '../../src/types/index.js';
import type { SpatialEntity } from '../../src/utils/spatialGrid.js';

// This test ensures that when the optimizer's internal grids are populated
// via updateSpatialGrids, queries through the optimizer return candidates
// even if the wrapped/base grid would be empty. This guards against
// regressions where optimizer queries defer to baseGrid which tests may
// leave unpopulated.

describe('AggressiveSpatialOptimizer - internal population contract', () => {
  it('returns candidates from internal fineGrid when baseGrid is empty', () => {
    // Create a baseGrid that always returns empty results to simulate tests
    // that do not populate the wrapped spatial grid directly.
    const baseGrid = {
      queryRadius: (_center: Vector3, _radius: number) => [] as SpatialEntity[],
    };

    const cellSize = 64;
    const optimizer = new AggressiveSpatialOptimizer(baseGrid, cellSize);

    // Create a single entity near origin and populate optimizer grids only
    const entities: SpatialEntity[] = [
      { id: 9999, pos: { x: 10, y: 5, z: 0 }, radius: 10, team: 'blue' },
    ];

    // Populate optimizer internal grids
    optimizer.updateSpatialGrids(entities);

    // Query k-nearest for a red ship at origin targeting blue team
    const center: Vector3 = { x: 0, y: 0, z: 0 };
    const results = optimizer.queryKNearestApproximate(center, 1, 'blue');

    expect(results.length).toBeGreaterThan(0);
    expect(results[0].id).toBe(9999);
  });
});
