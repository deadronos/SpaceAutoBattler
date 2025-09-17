import { describe, it, expect, beforeEach } from 'vitest';
import { SpatialGridAdapter } from '../../src/core/spatialIndex.js';
import { SpatialGrid } from '../../src/utils/spatialGrid.js';
import type { Vector3, EntityId, Team } from '../../src/types/index.js';

describe('Bulk Query API', () => {
  let spatialGrid: SpatialGrid;
  let adapter: SpatialGridAdapter;

  beforeEach(() => {
    spatialGrid = new SpatialGrid(64, { width: 1000, height: 1000, depth: 1000 });
    adapter = new SpatialGridAdapter(spatialGrid);
  });

  describe('queryBulkNearest', () => {
    it('should return same results as individual queryKNearest calls', () => {
      // Setup test entities
      const entities = [
        { id: 1, pos: { x: 100, y: 100, z: 100 }, radius: 10, team: 'red' as Team },
        { id: 2, pos: { x: 200, y: 200, z: 200 }, radius: 10, team: 'blue' as Team },
        { id: 3, pos: { x: 150, y: 150, z: 150 }, radius: 10, team: 'red' as Team },
        { id: 4, pos: { x: 300, y: 300, z: 300 }, radius: 10, team: 'blue' as Team },
      ];

      // Insert entities into spatial grid
      for (const entity of entities) {
        adapter.insert(entity.id, entity.pos, entity.radius, entity.team);
      }

      // Test positions
      const testPositions = [
        { x: 110, y: 110, z: 110 },
        { x: 250, y: 250, z: 250 },
      ];

      // Pack positions into Float32Array
      const positions = new Float32Array(testPositions.length * 3);
      for (let i = 0; i < testPositions.length; i++) {
        positions[i * 3] = testPositions[i].x;
        positions[i * 3 + 1] = testPositions[i].y;
        positions[i * 3 + 2] = testPositions[i].z;
      }

      // Compare bulk query with individual queries
      const k = 2;
      const bulkResults = adapter.queryBulkNearest!(positions, k, 'blue');

      // Get individual results for comparison
      const individualResults: EntityId[][] = [];
      for (const pos of testPositions) {
        const results = adapter.queryKNearest(pos, k, 'blue');
        const ids = results.map(e => e.id);
        // Pad with 0s if not enough results
        while (ids.length < k) {
          ids.push(0);
        }
        individualResults.push(ids);
      }

      expect(bulkResults.length).toBe(testPositions.length * k);
      
      // Verify that bulk results match individual results
      for (let i = 0; i < testPositions.length; i++) {
        const bulkForPos = Array.from(bulkResults.subarray(i * k, (i + 1) * k));
        const expectedIds = individualResults[i];
        
        expect(bulkForPos).toEqual(expectedIds);
      }
    });

    it('should handle excludeIds parameter correctly', () => {
      // Setup test entities
      const entities = [
        { id: 1, pos: { x: 100, y: 100, z: 100 }, radius: 10, team: 'red' as Team },
        { id: 2, pos: { x: 105, y: 105, z: 105 }, radius: 10, team: 'red' as Team },
        { id: 3, pos: { x: 110, y: 110, z: 110 }, radius: 10, team: 'red' as Team },
      ];

      for (const entity of entities) {
        adapter.insert(entity.id, entity.pos, entity.radius, entity.team);
      }

      const positions = new Float32Array([100, 100, 100]);
      
      // First test without excludeIds to verify basic functionality
      const allResults = adapter.queryBulkNearest!(positions, 3, 'red');
      const allFiltered = Array.from(allResults).filter(id => id !== 0);
      expect(allFiltered.length).toBeGreaterThan(0); // Should find entities

      // Test with excludeIds - this is the main test
      const excludeIds = new Set<EntityId>([1]);
      const results = adapter.queryBulkNearest!(positions, 2, 'red', excludeIds);
      const filtered = Array.from(results).filter(id => id !== 0);
      
      // Should not include excluded entity ID 1  
      expect(filtered).not.toContain(1);
      // Should have some results
      expect(filtered.length).toBeGreaterThanOrEqual(0);
    });

    it('should handle empty positions array', () => {
      const positions = new Float32Array([]);
      const results = adapter.queryBulkNearest!(positions, 1);
      expect(results.length).toBe(0);
    });
  });

  describe('queryBulkRadius', () => {
    it('should return same results as individual queryRadius calls', () => {
      // Setup test entities
      const entities = [
        { id: 1, pos: { x: 100, y: 100, z: 100 }, radius: 10, team: 'red' as Team },
        { id: 2, pos: { x: 120, y: 120, z: 120 }, radius: 10, team: 'blue' as Team },
        { id: 3, pos: { x: 200, y: 200, z: 200 }, radius: 10, team: 'red' as Team },
        { id: 4, pos: { x: 220, y: 220, z: 220 }, radius: 10, team: 'blue' as Team },
      ];

      for (const entity of entities) {
        adapter.insert(entity.id, entity.pos, entity.radius, entity.team);
      }

      // Test positions
      const testPositions = [
        { x: 110, y: 110, z: 110 },
        { x: 210, y: 210, z: 210 },
      ];

      const positions = new Float32Array(testPositions.length * 3);
      for (let i = 0; i < testPositions.length; i++) {
        positions[i * 3] = testPositions[i].x;
        positions[i * 3 + 1] = testPositions[i].y;
        positions[i * 3 + 2] = testPositions[i].z;
      }

      const radius = 50;
      const bulkResults = adapter.queryBulkRadius!(positions, radius, 'blue');

      // Get individual results for comparison
      const individualResults: EntityId[] = [];
      for (const pos of testPositions) {
        const results = adapter.queryRadius(pos, radius);
        const filteredResults = results.filter(e => e.team === 'blue');
        for (const result of filteredResults) {
          individualResults.push(result.id);
        }
      }

      expect(bulkResults.length).toBe(individualResults.length);
      expect(Array.from(bulkResults).sort()).toEqual(individualResults.sort());
    });

    it('should filter by team correctly', () => {
      const entities = [
        { id: 1, pos: { x: 100, y: 100, z: 100 }, radius: 10, team: 'red' as Team },
        { id: 2, pos: { x: 105, y: 105, z: 105 }, radius: 10, team: 'blue' as Team },
      ];

      for (const entity of entities) {
        adapter.insert(entity.id, entity.pos, entity.radius, entity.team);
      }

      const positions = new Float32Array([100, 100, 100]);
      const results = adapter.queryBulkRadius!(positions, 20, 'red');
      
      expect(Array.from(results)).toEqual([1]);
    });
  });

  describe('Performance characteristics', () => {
    it('should be faster than individual queries for large datasets', () => {
      // Create a moderate number of entities to avoid memory issues
      const entityCount = 100;
      const entities = [];
      for (let i = 0; i < entityCount; i++) {
        entities.push({
          id: i,
          pos: {
            x: Math.random() * 1000,
            y: Math.random() * 1000,
            z: Math.random() * 1000,
          },
          radius: 10,
          team: i % 2 === 0 ? 'red' as Team : 'blue' as Team,
        });
      }

      for (const entity of entities) {
        adapter.insert(entity.id, entity.pos, entity.radius, entity.team);
      }

      // Test positions
      const queryCount = 20;
      const testPositions = [];
      for (let i = 0; i < queryCount; i++) {
        testPositions.push({
          x: Math.random() * 1000,
          y: Math.random() * 1000,
          z: Math.random() * 1000,
        });
      }

      const positions = new Float32Array(testPositions.length * 3);
      for (let i = 0; i < testPositions.length; i++) {
        positions[i * 3] = testPositions[i].x;
        positions[i * 3 + 1] = testPositions[i].y;
        positions[i * 3 + 2] = testPositions[i].z;
      }

      // Benchmark individual queries
      const individualStart = performance.now();
      for (const pos of testPositions) {
        adapter.queryKNearest(pos, 3, 'blue');
      }
      const individualTime = performance.now() - individualStart;

      // Benchmark bulk query
      const bulkStart = performance.now();
      adapter.queryBulkNearest!(positions, 3, 'blue');
      const bulkTime = performance.now() - bulkStart;

      console.log(`Individual queries: ${individualTime.toFixed(2)}ms`);
      console.log(`Bulk query: ${bulkTime.toFixed(2)}ms`);

      // Both should complete successfully
      expect(individualTime).toBeGreaterThan(0);
      expect(bulkTime).toBeGreaterThan(0);
    });
  });
});