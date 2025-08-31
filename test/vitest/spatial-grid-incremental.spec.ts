import { describe, it, expect } from 'vitest';
import { SpatialGrid } from '../../src/utils/spatialGrid.js';

describe('SpatialGrid incremental operations', () => {
  it('insert, update (move), remove and gcExcept behave correctly', () => {
    const grid = new SpatialGrid(50, { width: 1000, height: 800, depth: 400 });

    // Insert three entities
    grid.insert({ id: 1, pos: { x: 100, y: 100, z: 50 }, radius: 16, team: 'red' });
    grid.insert({ id: 2, pos: { x: 120, y: 110, z: 50 }, radius: 16, team: 'red' });
    grid.insert({ id: 3, pos: { x: 400, y: 300, z: 50 }, radius: 16, team: 'blue' });

    let stats = grid.getStats();
    expect(stats.totalEntities).toBe(3);

    // Move entity 1 far away via update
    grid.update(1, { x: 600, y: 600, z: 50 }, 16, 'red');
    // After moving, it should no longer be near entity 2
    const neighborsAt100 = grid.queryNeighbors({ x: 120, y: 110, z: 50 }, 100, 'red');
    // Only id 2 should remain near the original cluster
    expect(neighborsAt100.map(n => n.id)).toEqual([2]);

    // Remove entity 2
    grid.remove(2);
    stats = grid.getStats();
    expect(stats.totalEntities).toBe(2);

    // gcExcept should remove any ids not in the active set
    const active = new Set<number>([1]);
    grid.gcExcept(active);
    stats = grid.getStats();
    // Only id 1 should remain
    expect(stats.totalEntities).toBe(1);

    // Ensure queries still work for remaining entity (id 1)
    const found = grid.queryRadius({ x: 600, y: 600, z: 50 }, 10);
    expect(found.length).toBeGreaterThanOrEqual(1);
    expect(found.some(e => e.id === 1)).toBe(true);
  });
});
