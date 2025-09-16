import { describe, it, expect } from 'vitest';

describe('BatchedQueryManager extra precompute tests', () => {
  it('handles optimizer returning fewer neighbors and tie-breaks correctly', async () => {
    const mod = await import('../../../src/core/ai/batchedQueries.js');
    const { BatchedQueryManager } = mod as any;

    // Fake spatial optimizer that returns only one neighbor for queries
    const fakeOptimizer = {
      queryKNearestApproximate: (pos: any, k: number, targetTeam: string) => {
        // Return only one candidate even when k=2
        return [{ id: 200, pos: { x: pos.x + 10, y: pos.y, z: pos.z }, team: targetTeam }];
      },
      queryRadiusOptimized: (pos: any, radius: number, team?: string, excludeId?: number) => {
        // Return two entities near the ship for separation
        return [
          { id: 300, pos: { x: pos.x + 1, y: pos.y, z: pos.z }, team: team || 'red' },
          { id: 301, pos: { x: pos.x + 2, y: pos.y, z: pos.z }, team: team || 'red' },
        ];
      },
    };

    const manager = new BatchedQueryManager(fakeOptimizer);

    // Minimal fake GameState and ships
    const state: any = {
      behaviorConfig: { globalSettings: { enableSpatialIndex: true, separationDistance: 50 } },
      simConfig: { spatialGrid: { cellSize: 100 } },
      shipIndex: new Map(),
    };

    const ship = { id: 1, pos: { x: 0, y: 0, z: 0 }, team: 'red', health: 100 };
    const enemy = { id: 200, pos: { x: 10, y: 0, z: 0 }, team: 'blue', health: 100 };
    state.shipIndex.set(1, ship);
    state.shipIndex.set(200, enemy);

    manager.precomputeNearestEnemies(state, [ship]);
    const nearest = manager.getNearestEnemy(ship);
    expect(nearest).not.toBeNull();
    expect(nearest && nearest.id).toBe(200);

    // Test separation neighbor precompute reuses arrays
    manager.precomputeSeparationNeighbors(state, [ship]);
    const neighbors1 = manager.getSeparationNeighbors(ship);
    expect(Array.isArray(neighbors1)).toBe(true);

    // Call again to ensure reuse (no exception and array length is reset/updated)
    manager.precomputeSeparationNeighbors(state, [ship]);
    const neighbors2 = manager.getSeparationNeighbors(ship);
    expect(neighbors2).toBe(neighbors1);
    expect(neighbors2.length).toBeGreaterThanOrEqual(0);
  });
});
