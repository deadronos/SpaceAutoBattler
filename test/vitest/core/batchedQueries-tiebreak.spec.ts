/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect } from 'vitest';
import { BatchedQueryManager } from '../../../src/core/ai/batchedQueries';

describe('BatchedQueryManager tie-break behavior', () => {
  it('selects the lower id when distances equal', () => {
    // Create a fake spatial optimizer that returns two candidates at equal distance
    const fakeOptimizer: any = {
      queryKNearestApproximate: (_pos: any, _k: number, _team: any) => {
        return [ { id: 2, pos: { x: 10, y: 0, z: 0 } }, { id: 1, pos: { x: 10, y: 0, z: 0 } } ];
      }
    };

    const mgr = new BatchedQueryManager(fakeOptimizer);

    // minimal GameState with shipIndex
    const shipA: any = { id: 100, team: 'red', pos: { x: 0, y: 0, z: 0 } };
    const candidate1: any = { id: 2, pos: { x: 10, y: 0, z: 0 } };
    const candidate2: any = { id: 1, pos: { x: 10, y: 0, z: 0 } };

    const gameState: any = {
      behaviorConfig: { globalSettings: { enableSpatialIndex: true } },
      shipIndex: new Map([[2, candidate1], [1, candidate2]])
    };

    mgr.precomputeNearestEnemies(gameState, [shipA]);
    const selected = mgr.getNearestEnemy(shipA);
    // expect ship id 1 to be chosen because b.id < a.id when distances equal
    expect(selected && selected.id).toBe(1);
  });
});
