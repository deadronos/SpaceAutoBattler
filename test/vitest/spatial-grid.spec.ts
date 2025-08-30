import { describe, it, expect, beforeEach } from 'vitest';
import { SpatialGrid } from '../../src/utils/spatialGrid.js';
import type { SpatialEntity } from '../../src/utils/spatialGrid.js';

describe('Spatial Grid Unit Tests', () => {
  let spatialGrid: SpatialGrid;

  beforeEach(() => {
    spatialGrid = new SpatialGrid(64, { width: 1000, height: 800, depth: 600 });
  });

  it('should insert and query entities correctly', () => {
    const entity1: SpatialEntity = {
      id: 1,
      pos: { x: 100, y: 100, z: 100 },
      radius: 16,
      team: 'red'
    };

    const entity2: SpatialEntity = {
      id: 2,
      pos: { x: 150, y: 100, z: 100 },
      radius: 16,
      team: 'red'
    };

    spatialGrid.insert(entity1);
    spatialGrid.insert(entity2);

    // Query radius should find both entities
    const results = spatialGrid.queryRadius({ x: 125, y: 100, z: 100 }, 50);
    expect(results).toHaveLength(2);
    expect(results.some(e => e.id === 1)).toBe(true);
    expect(results.some(e => e.id === 2)).toBe(true);
  });

  it('should filter by team correctly', () => {
    const redEntity: SpatialEntity = {
      id: 1,
      pos: { x: 100, y: 100, z: 100 },
      radius: 16,
      team: 'red'
    };

    const blueEntity: SpatialEntity = {
      id: 2,
      pos: { x: 150, y: 100, z: 100 },
      radius: 16,
      team: 'blue'
    };

    spatialGrid.insert(redEntity);
    spatialGrid.insert(blueEntity);

    // Query neighbors (same team)
    const neighbors = spatialGrid.queryNeighbors({ x: 125, y: 100, z: 100 }, 50, 'red');
    expect(neighbors).toHaveLength(1);
    expect(neighbors[0].id).toBe(1);

    // Query enemies (different team)
    const enemies = spatialGrid.queryEnemies({ x: 125, y: 100, z: 100 }, 50, 'red');
    expect(enemies).toHaveLength(1);
    expect(enemies[0].id).toBe(2);
  });

  it('should handle empty grid correctly', () => {
    const results = spatialGrid.queryRadius({ x: 100, y: 100, z: 100 }, 50);
    expect(results).toHaveLength(0);
  });

  it('should handle clear correctly', () => {
    const entity: SpatialEntity = {
      id: 1,
      pos: { x: 100, y: 100, z: 100 },
      radius: 16,
      team: 'red'
    };

    spatialGrid.insert(entity);
    spatialGrid.clear();

    const results = spatialGrid.queryRadius({ x: 100, y: 100, z: 100 }, 50);
    expect(results).toHaveLength(0);
  });
});