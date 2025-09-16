import { describe, it, expect } from 'vitest';
import { initEntityIndex } from '../../src/core/entityIndex.js';

describe('UniformGrid + Miniplex entity index', () => {
  it('finds neighbors inside radius and excludes outside', () => {
    const idx = initEntityIndex(10);
    // center at origin
    idx.add({ id: 1, x: 0, y: 0, z: 0, team: 'red', radius: 1 });
    idx.add({ id: 2, x: 5, y: 0, z: 0, team: 'blue', radius: 1 });
    idx.add({ id: 3, x: 20, y: 0, z: 0, team: 'red', radius: 1 });

    const near = idx.queryNeighbors(0, 0, 0, 6);
    const ids = near.map((e) => e.id).sort((a, b) => a - b);
    expect(ids).toEqual([1, 2]);

    const nearRed = idx.queryNeighbors(0, 0, 0, 6, { team: 'red' });
    expect(nearRed.map((e) => e.id)).toEqual([1]);
  });
});
