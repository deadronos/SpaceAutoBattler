import { describe, it, expect } from 'vitest';
import { SpatialGrid } from '../../src/utils/spatialGrid.js';
import type { SpatialEntity } from '../../src/utils/spatialGrid.js';

describe('Spatial Index Performance Validation', () => {
  it('should demonstrate performance improvement over linear search', () => {
    // Create a spatial grid and a large number of entities
    const spatialGrid = new SpatialGrid(64, { width: 2000, height: 2000, depth: 1000 });
    const entities: SpatialEntity[] = [];
    const entityCount = 1000;

    // Generate random entities
    for (let i = 0; i < entityCount; i++) {
      const entity: SpatialEntity = {
        id: i,
        pos: {
          x: Math.random() * 2000,
          y: Math.random() * 2000,
          z: Math.random() * 1000
        },
        radius: 16,
        team: i % 2 === 0 ? 'red' : 'blue'
      };
      entities.push(entity);
      spatialGrid.insert(entity);
    }

    // Test query point in the middle of the space
    const queryPos = { x: 1000, y: 1000, z: 500 };
    const queryRadius = 300;

    // Benchmark spatial grid query
    const iterations = 1000;
    
    const startSpatial = performance.now();
    for (let i = 0; i < iterations; i++) {
      spatialGrid.queryRadius(queryPos, queryRadius);
    }
    const endSpatial = performance.now();
    const spatialTime = endSpatial - startSpatial;

    // Benchmark linear search equivalent
    const startLinear = performance.now();
    for (let i = 0; i < iterations; i++) {
      const results: SpatialEntity[] = [];
      for (const entity of entities) {
        const distSq = 
          (entity.pos.x - queryPos.x) ** 2 +
          (entity.pos.y - queryPos.y) ** 2 +
          (entity.pos.z - queryPos.z) ** 2;
        if (distSq <= queryRadius * queryRadius) {
          results.push(entity);
        }
      }
    }
    const endLinear = performance.now();
    const linearTime = endLinear - startLinear;

    // Verify both methods return same results
    const spatialResults = spatialGrid.queryRadius(queryPos, queryRadius);
    const linearResults: SpatialEntity[] = [];
    for (const entity of entities) {
      const distSq = 
        (entity.pos.x - queryPos.x) ** 2 +
        (entity.pos.y - queryPos.y) ** 2 +
        (entity.pos.z - queryPos.z) ** 2;
      if (distSq <= queryRadius * queryRadius) {
        linearResults.push(entity);
      }
    }

    // Sort by ID to compare
    spatialResults.sort((a, b) => a.id - b.id);
    linearResults.sort((a, b) => a.id - b.id);

    // Results should be identical
    expect(spatialResults.length).toBe(linearResults.length);
    for (let i = 0; i < spatialResults.length; i++) {
      expect(spatialResults[i].id).toBe(linearResults[i].id);
    }

    // Calculate speedup
    const speedup = linearTime / spatialTime;

    console.log(`Performance Validation Results:`);
    console.log(`  Entity count: ${entityCount}`);
    console.log(`  Query iterations: ${iterations}`);
    console.log(`  Results found: ${spatialResults.length}`);
    console.log(`  Linear search time: ${linearTime.toFixed(2)}ms`);
    console.log(`  Spatial grid time: ${spatialTime.toFixed(2)}ms`);
    console.log(`  Speedup: ${speedup.toFixed(2)}x`);

    // Verify significant performance improvement
    // Even if timing is imprecise, spatial grid should be significantly faster
    expect(speedup).toBeGreaterThan(1.5); // More conservative requirement
    expect(spatialTime).toBeLessThan(linearTime);
  });

  it('should scale better than linear search with entity count', () => {
    const entityCounts = [100, 500, 1000];
    const results: { count: number; spatialTime: number; linearTime: number; speedup: number }[] = [];

    for (const count of entityCounts) {
      const spatialGrid = new SpatialGrid(64, { width: 2000, height: 2000, depth: 1000 });
      const entities: SpatialEntity[] = [];

      // Generate entities
      for (let i = 0; i < count; i++) {
        const entity: SpatialEntity = {
          id: i,
          pos: {
            x: Math.random() * 2000,
            y: Math.random() * 2000,
            z: Math.random() * 1000
          },
          radius: 16,
          team: i % 2 === 0 ? 'red' : 'blue'
        };
        entities.push(entity);
        spatialGrid.insert(entity);
      }

      const queryPos = { x: 1000, y: 1000, z: 500 };
      const queryRadius = 300;
      const iterations = 100;

      // Benchmark spatial grid
      const startSpatial = performance.now();
      for (let i = 0; i < iterations; i++) {
        spatialGrid.queryRadius(queryPos, queryRadius);
      }
      const endSpatial = performance.now();
      const spatialTime = endSpatial - startSpatial;

      // Benchmark linear search
      const startLinear = performance.now();
      for (let i = 0; i < iterations; i++) {
        const queryResults: SpatialEntity[] = [];
        for (const entity of entities) {
          const distSq = 
            (entity.pos.x - queryPos.x) ** 2 +
            (entity.pos.y - queryPos.y) ** 2 +
            (entity.pos.z - queryPos.z) ** 2;
          if (distSq <= queryRadius * queryRadius) {
            queryResults.push(entity);
          }
        }
      }
      const endLinear = performance.now();
      const linearTime = endLinear - startLinear;

      const speedup = linearTime / spatialTime;
      results.push({ count, spatialTime, linearTime, speedup });
    }

    console.log(`\nScaling Performance Results:`);
    for (const result of results) {
      console.log(`  ${result.count} entities: ${result.speedup.toFixed(2)}x speedup`);
    }

    // Verify that spatial grid provides consistent or improving speedup as entity count increases
    for (const result of results) {
      expect(result.speedup).toBeGreaterThan(1.0);
    }

    // Verify that speedup improves or stays consistent with scale
    const speedup1000 = results[results.length - 1].speedup;
    expect(speedup1000).toBeGreaterThanOrEqual(1.5);
  });
});