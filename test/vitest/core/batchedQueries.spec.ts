import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('BatchedQueryManager', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
  });

  it('skips precomputeNearestEnemies when no optimizer or index disabled', async () => {
    const mod = await import('../../../src/core/ai/batchedQueries');
    const { BatchedQueryManager } = mod as any;
    const mgr = new BatchedQueryManager();

    const state: any = { behaviorConfig: { globalSettings: { enableSpatialIndex: false } } };
    const ship = { id: 1, pos: { x: 0, y: 0, z: 0 }, team: 'red' } as any;

    mgr.precomputeNearestEnemies(state, [ship]);
    expect(mgr.getNearestEnemy(ship)).toBeNull();
  });

  it('selects nearest enemy and applies tiebreak rules', async () => {
    const mod = await import('../../../src/core/ai/batchedQueries');
    const { BatchedQueryManager } = mod as any;
    // mock spatial optimizer
    const spatialOptimizer: any = {
      queryKNearestApproximate: (pos: any, n: number, team: string) => {
        // return two candidates in predictable order
        return [
          { id: 2, pos: { x: 10, y: 0, z: 0 } },
          { id: 3, pos: { x: 5, y: 0, z: 0 } },
        ];
      },
    };

    const mgr = new BatchedQueryManager(spatialOptimizer);

    const ship = { id: 1, pos: { x: 0, y: 0, z: 0 }, team: 'red' } as any;

    const a = { id: 2, pos: { x: 10, y: 0, z: 0 } } as any;
    const b = { id: 3, pos: { x: 5, y: 0, z: 0 } } as any;

    const state: any = {
      behaviorConfig: { globalSettings: { enableSpatialIndex: true } },
      shipIndex: new Map([
        [2, a],
        [3, b],
      ]),
    };

    mgr.precomputeNearestEnemies(state, [ship]);
    const nearest = mgr.getNearestEnemy(ship);
    expect(nearest).not.toBeNull();
    expect(nearest!.id).toBe(3); // b is closer

    // now test tie-breaker: equal distances but lower id wins (b.id < a.id)
    spatialOptimizer.queryKNearestApproximate = () => [
      { id: 4, pos: { x: 5, y: 0, z: 0 } },
      { id: 3, pos: { x: 5, y: 0, z: 0 } },
    ];
    const a2 = { id: 4, pos: { x: 5, y: 0, z: 0 } } as any;
    state.shipIndex.set(4, a2);

    mgr.precomputeNearestEnemies(state, [ship]);
    const nearest2 = mgr.getNearestEnemy(ship);
    // b (id 3) should be chosen because id 3 < 4 when distances equal
    expect(nearest2).not.toBeNull();
    expect(nearest2!.id).toBe(3);
  });

  it('precomputes separation neighbors and reuses arrays', async () => {
    const mod = await import('../../../src/core/ai/batchedQueries');
    const { BatchedQueryManager } = mod as any;
    const spatialOptimizer: any = {
      queryRadiusOptimized: (pos: any, range: number, team: string, id: number) => {
        // return one neighbor at (3,0,0) and the ship itself
        return [{ id: 99, pos: { x: 3, y: 0, z: 0 }, team: team }];
      },
    };

    const mgr = new BatchedQueryManager(spatialOptimizer);

    const ship = { id: 1, pos: { x: 0, y: 0, z: 0 }, team: 'red' } as any;
    const state: any = {
      behaviorConfig: { globalSettings: { enableSpatialIndex: true, separationDistance: 10 } },
    };

    mgr.precomputeSeparationNeighbors(state, [ship]);
    const first = mgr.getSeparationNeighbors(ship);
    expect(first.length).toBeGreaterThan(0);

    // call again - should reuse same array object (cleared and repopulated)
    mgr.precomputeSeparationNeighbors(state, [ship]);
    const second = mgr.getSeparationNeighbors(ship);
    expect(second).toBe(first);
  });
});
