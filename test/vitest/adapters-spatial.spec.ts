import { describe, it, expect, beforeEach } from 'vitest';
import { 
  SpatialIndex, 
  SpatialGridAdapter,
  NoopSpatialIndex,
  AABB,
  SpatialQueryResult
} from '../../src/core/spatialIndex.js';
import { SpatialGrid, SpatialEntity } from '../../src/utils/spatialGrid.js';

describe('SpatialIndex', () => {
  describe('SpatialGridAdapter', () => {
    let spatialGrid: SpatialGrid;
    let adapter: SpatialGridAdapter;

    beforeEach(() => {
      spatialGrid = new SpatialGrid(100); // 100 unit cell size
      adapter = new SpatialGridAdapter(spatialGrid);
      adapter.clear(); // Ensure clean state
    });

    it('should delegate basic operations to SpatialGrid', () => {
      const entityId = 1;
      const pos = { x: 50, y: 50, z: 50 };
      const radius = 10;
      const team = 'red' as const;

      // Insert entity
      adapter.insert(entityId, pos, radius, team);
      
      // Query should find the entity
      const results = adapter.queryRadius(pos, 50);
      expect(results.length).toBeGreaterThan(0);
      expect(results.some(e => e.id === entityId)).toBe(true);

      // Remove entity
      adapter.remove(entityId);
      const resultsAfterRemoval = adapter.queryRadius(pos, 50);
      expect(resultsAfterRemoval.some(e => e.id === entityId)).toBe(false);
    });

    it('should provide enhanced AABB queries', () => {
      // Clear any existing entities first
      adapter.clear();
      
      // Add some entities
      adapter.insert(1, { x: 0, y: 0, z: 0 }, 5, 'red');
      adapter.insert(2, { x: 100, y: 100, z: 100 }, 5, 'blue');
      adapter.insert(3, { x: 50, y: 50, z: 50 }, 5, 'red');

      const aabb: AABB = {
        min: { x: -10, y: -10, z: -10 },
        max: { x: 60, y: 60, z: 60 }
      };

      const results = adapter.queryAABB(aabb);
      
      // Should include entities 1 and 3, but not 2
      expect(results).toContain(1);
      expect(results).toContain(3);
      expect(results).not.toContain(2);
    });

    it('should support layer mask filtering', () => {
      adapter.insert(1, { x: 0, y: 0, z: 0 }, 5, 'red');
      adapter.insert(2, { x: 10, y: 10, z: 10 }, 5, 'blue');
      adapter.insert(3, { x: 20, y: 20, z: 20 }, 5, 'red');

      const aabb: AABB = {
        min: { x: -50, y: -50, z: -50 },
        max: { x: 50, y: 50, z: 50 }
      };

      // Layer 0 = red team, Layer 1 = blue team
      const redLayerMask = 1 << 0; // Only red
      const blueLayerMask = 1 << 1; // Only blue
      const allLayerMask = (1 << 0) | (1 << 1); // Both

      const redResults = adapter.queryAABB(aabb, redLayerMask);
      const blueResults = adapter.queryAABB(aabb, blueLayerMask);
      const allResults = adapter.queryAABB(aabb, allLayerMask);

      expect(redResults).toContain(1);
      expect(redResults).toContain(3);
      expect(redResults).not.toContain(2);

      expect(blueResults).toContain(2);
      expect(blueResults).not.toContain(1);
      expect(blueResults).not.toContain(3);

      expect(allResults).toContain(1);
      expect(allResults).toContain(2);
      expect(allResults).toContain(3);
    });

    it('should provide radius queries with distance information', () => {
      adapter.clear();
      adapter.insert(1, { x: 0, y: 0, z: 0 }, 5, 'red');
      adapter.insert(2, { x: 30, y: 0, z: 0 }, 5, 'blue');
      adapter.insert(3, { x: 0, y: 40, z: 0 }, 5, 'red');

      const center = { x: 0, y: 0, z: 0 };
      const results = adapter.queryRadiusWithDistance(center, 50);

      expect(results.length).toBe(3);
      
      // Results should be sorted by distance
      expect(results[0].distance).toBeLessThanOrEqual(results[1].distance);
      expect(results[1].distance).toBeLessThanOrEqual(results[2].distance);

      // Check closest entity (should be entity 1)
      expect(results[0].entity.id).toBe(1);
      expect(results[0].distance).toBeCloseTo(0, 1);

      // Check direction vectors are normalized
      for (const result of results) {
        if (result.distance > 0) {
          const dirLength = Math.sqrt(
            result.direction.x ** 2 + 
            result.direction.y ** 2 + 
            result.direction.z ** 2
          );
          expect(dirLength).toBeCloseTo(1, 3);
        }
      }
    });

    it('should support raycast queries', () => {
      adapter.clear();
      // Place entities in a line
      adapter.insert(1, { x: 10, y: 0, z: 0 }, 5, 'red');
      adapter.insert(2, { x: 30, y: 0, z: 0 }, 5, 'blue');
      adapter.insert(3, { x: 50, y: 0, z: 0 }, 5, 'red');

      const from = { x: -10, y: 0, z: 0 };
      const to = { x: 100, y: 0, z: 0 };

      const results = adapter.raycast(from, to);

      expect(results.length).toBe(3);
      
      // Results should be sorted by t (time along ray)
      expect(results[0].t).toBeLessThanOrEqual(results[1].t);
      expect(results[1].t).toBeLessThanOrEqual(results[2].t);

      // First hit should be entity 1
      expect(results[0].entityId).toBe(1);
      expect(results[0].t).toBeGreaterThan(0);
      expect(results[0].t).toBeLessThan(1);
    });

    it('should support layer-based queries', () => {
      adapter.insert(1, { x: 0, y: 0, z: 0 }, 5, 'red');
      adapter.insert(2, { x: 10, y: 10, z: 10 }, 5, 'blue');
      adapter.insert(3, { x: 20, y: 20, z: 20 }, 5, 'red');

      const center = { x: 15, y: 15, z: 15 };
      const radius = 30;

      const redLayer = adapter.queryLayer(center, radius, 0); // red = layer 0
      const blueLayer = adapter.queryLayer(center, radius, 1); // blue = layer 1

      expect(redLayer.every(e => e.team === 'red')).toBe(true);
      expect(blueLayer.every(e => e.team === 'blue')).toBe(true);

      // Test layer mask queries
      const redMask = 1 << 0;
      const blueMask = 1 << 1;
      const bothMask = redMask | blueMask;

      const redMaskResults = adapter.queryLayerMask(center, radius, redMask);
      const blueMaskResults = adapter.queryLayerMask(center, radius, blueMask);
      const bothMaskResults = adapter.queryLayerMask(center, radius, bothMask);

      expect(redMaskResults.every(e => e.team === 'red')).toBe(true);
      expect(blueMaskResults.every(e => e.team === 'blue')).toBe(true);
      expect(bothMaskResults.length).toBe(redMaskResults.length + blueMaskResults.length);
    });

    it('should track query statistics', () => {
      const initialStats = adapter.getStats();
      expect(initialStats.queriesPerFrame).toBe(0);

      // Perform some queries
      adapter.queryRadius({ x: 0, y: 0, z: 0 }, 10);
      adapter.queryAABB({ min: { x: 0, y: 0, z: 0 }, max: { x: 10, y: 10, z: 10 } });

      const statsAfterQueries = adapter.getStats();
      expect(statsAfterQueries.queriesPerFrame).toBeGreaterThan(initialStats.queriesPerFrame);
    });

    it('should handle initialization and disposal', () => {
      const config = { cellSize: 50, worldAABB: { min: { x: -1000, y: -1000, z: -1000 }, max: { x: 1000, y: 1000, z: 1000 } } };
      
      // Should not throw
      expect(() => adapter.init(config)).not.toThrow();
      expect(() => adapter.dispose?.()).not.toThrow();
    });

    it('should garbage collect correctly', () => {
      adapter.insert(1, { x: 0, y: 0, z: 0 }, 5, 'red');
      adapter.insert(2, { x: 10, y: 10, z: 10 }, 5, 'blue');
      adapter.insert(3, { x: 20, y: 20, z: 20 }, 5, 'red');

      // Keep only entities 1 and 3
      const activeIds = new Set([1, 3]);
      adapter.gcExcept(activeIds);

      const allResults = adapter.queryRadius({ x: 15, y: 15, z: 15 }, 50);
      
      expect(allResults.some(e => e.id === 1)).toBe(true);
      expect(allResults.some(e => e.id === 2)).toBe(false); // Should be removed
      expect(allResults.some(e => e.id === 3)).toBe(true);
    });
  });

  describe('NoopSpatialIndex', () => {
    let adapter: NoopSpatialIndex;

    beforeEach(() => {
      adapter = new NoopSpatialIndex();
    });

    it('should implement all interface methods safely', () => {
      const pos = { x: 0, y: 0, z: 0 };
      const aabb = { min: { x: -10, y: -10, z: -10 }, max: { x: 10, y: 10, z: 10 } };

      // All operations should not throw and return empty/safe results
      expect(() => adapter.init({ cellSize: 100 })).not.toThrow();
      expect(() => adapter.clear()).not.toThrow();
      expect(() => adapter.insert(1, pos, 5, 'red')).not.toThrow();
      expect(() => adapter.update(1, pos, 5, 'red')).not.toThrow();
      expect(() => adapter.remove(1)).not.toThrow();
      expect(() => adapter.gcExcept(new Set([1]))).not.toThrow();

      expect(adapter.queryRadius(pos, 10)).toEqual([]);
      expect(adapter.queryAABB(aabb)).toEqual([]);
      expect(adapter.queryRadiusWithDistance(pos, 10)).toEqual([]);
      expect(adapter.raycast(pos, { x: 10, y: 0, z: 0 })).toEqual([]);
      expect(adapter.queryLayer(pos, 10, 0)).toEqual([]);
      expect(adapter.queryLayerMask(pos, 10, 1)).toEqual([]);

      const stats = adapter.getStats();
      expect(stats.items).toBe(0);
      expect(stats.cells).toBe(0);
      expect(stats.avgItemsPerCell).toBe(0);
    });

    it('should handle forEach methods without throwing', () => {
      let callCount = 0;
      const fn = () => { callCount++; };

      adapter.forEachInRadius({ x: 0, y: 0, z: 0 }, 10, fn);
      adapter.forEachNeighborsDelta({ x: 0, y: 0, z: 0 }, 10, 'red', undefined, fn);

      expect(callCount).toBe(0); // No entities, so no calls
    });
  });

  describe('Interface compliance', () => {
    it('should implement all required methods', () => {
      const gridAdapter = new SpatialGridAdapter(new SpatialGrid(100));
      const noopAdapter = new NoopSpatialIndex();

      const requiredMethods = [
        'init', 'clear', 'insert', 'update', 'remove', 'gcExcept',
        'queryRadius', 'forEachInRadius', 'queryKNearest', 'querySector',
        'queryNeighbors', 'forEachNeighborsDelta', 'queryEnemies', 'queryBulletCollisions',
        'queryAABB', 'queryRadiusWithDistance', 'raycast', 'queryLayer', 'queryLayerMask',
        'getStats'
      ];

      for (const method of requiredMethods) {
        expect(typeof (gridAdapter as any)[method]).toBe('function');
        expect(typeof (noopAdapter as any)[method]).toBe('function');
      }
    });

    it('should have correct type structure for AABB', () => {
      const aabb: AABB = {
        min: { x: -100, y: -50, z: -25 },
        max: { x: 100, y: 50, z: 25 }
      };

      expect(aabb.min).toBeDefined();
      expect(aabb.max).toBeDefined();
      expect(typeof aabb.min.x).toBe('number');
      expect(typeof aabb.max.x).toBe('number');
    });

    it('should have correct type structure for SpatialQueryResult', () => {
      const result: SpatialQueryResult = {
        entity: {
          id: 42,
          pos: { x: 1, y: 2, z: 3 },
          radius: 5,
          team: 'red'
        },
        distance: 10.5,
        direction: { x: 0.6, y: 0.8, z: 0 }
      };

      expect(result.entity).toBeDefined();
      expect(result.entity.id).toBe(42);
      expect(result.distance).toBe(10.5);
      expect(result.direction).toBeDefined();
    });
  });

  describe('Performance characteristics', () => {
    let spatialGrid: SpatialGrid;
    let adapter: SpatialGridAdapter;

    beforeEach(() => {
      spatialGrid = new SpatialGrid(100);
      adapter = new SpatialGridAdapter(spatialGrid);
    });

    it('should handle large numbers of entities efficiently', () => {
      const entityCount = 1000;
      
      // Add many entities
      for (let i = 0; i < entityCount; i++) {
        adapter.insert(
          i,
          { x: Math.random() * 1000, y: Math.random() * 1000, z: Math.random() * 1000 },
          5,
          i % 2 === 0 ? 'red' : 'blue'
        );
      }

      // Query should still be fast
      const start = performance.now();
      const results = adapter.queryRadius({ x: 500, y: 500, z: 500 }, 100);
      const end = performance.now();

      expect(results.length).toBeGreaterThan(0);
      expect(end - start).toBeLessThan(100); // Should be fast
    });

    it('should provide meaningful statistics', () => {
      // Add some entities
      for (let i = 0; i < 10; i++) {
        adapter.insert(i, { x: i * 10, y: 0, z: 0 }, 5, 'red');
      }

      const stats = adapter.getStats();
      
      expect(stats).toHaveProperty('items');
      expect(stats).toHaveProperty('cells');
      expect(stats).toHaveProperty('avgItemsPerCell');
      expect(stats).toHaveProperty('queriesPerFrame');
      expect(stats).toHaveProperty('totalMemoryUsage');

      expect(typeof stats.items).toBe('number');
      expect(typeof stats.cells).toBe('number');
      expect(typeof stats.avgItemsPerCell).toBe('number');
    });
  });
});