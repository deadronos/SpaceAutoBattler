import { BatchedQueryManager } from '../../../src/core/ai/batchedQueries';

// Minimal types to satisfy the test imports
type Vec3 = { x: number; y: number; z: number };
type Ship = { id: number; team: 'red' | 'blue'; pos: Vec3; health?: number };

describe('BatchedQueryManager precompute behaviors', () => {
  test('handles optimizer returning fewer neighbors gracefully', () => {
    const fakeOptimizer = {
      queryKNearestApproximate: (_pos: Vec3, _k: number, _team: string) => [] as unknown as any,
      queryRadiusOptimized: (_pos: Vec3, _r: number, _team: string, _excludeId?: number) =>
        [] as unknown as any,
    } as any;

    const manager = new BatchedQueryManager(fakeOptimizer);
    const state: any = {
      behaviorConfig: { globalSettings: { enableSpatialIndex: true, separationDistance: 50 } },
      shipIndex: new Map<number, Ship>(),
      simConfig: { spatialGrid: { cellSize: 100 } },
    };

    const ships: Ship[] = [{ id: 1, team: 'red', pos: { x: 0, y: 0, z: 0 } }];

    // Should not throw when optimizer returns empty arrays
    manager.precomputeNearestEnemies(state as any, ships as any);
    expect(manager.getNearestEnemy(ships[0] as any)).toBeNull();
  });

  test('reuses separation neighbor arrays between calls', () => {
    const neighborPos = { x: 1, y: 0, z: 0 };
    const fakeOptimizer = {
      queryKNearestApproximate: () => [] as unknown as any,
      queryRadiusOptimized: (_pos: Vec3, _r: number, _team: string, _excludeId?: number) => {
        return [{ id: 2, team: 'blue', pos: neighborPos }] as unknown as any;
      },
    } as any;

    const manager = new BatchedQueryManager(fakeOptimizer);
    const state: any = {
      behaviorConfig: { globalSettings: { enableSpatialIndex: true, separationDistance: 50 } },
      shipIndex: new Map<number, Ship>(),
      simConfig: { spatialGrid: { cellSize: 100 } },
    };

    const ship = { id: 10, team: 'red' as const, pos: { x: 0, y: 0, z: 0 } };
    const ships = [ship];

    manager.precomputeSeparationNeighbors(state as any, ships as any);
    const first = manager.getSeparationNeighbors(ship as any);
    expect(first.length).toBeGreaterThanOrEqual(0);

    // Call again and ensure same array object is reused (cleared and repopulated)
    manager.precomputeSeparationNeighbors(state as any, ships as any);
    const second = manager.getSeparationNeighbors(ship as any);
    expect(second).toBe(first);
  });
});
