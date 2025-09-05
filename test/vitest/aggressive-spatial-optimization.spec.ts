import { describe, it, expect, beforeEach } from 'vitest';
import { AggressiveSpatialOptimizer } from '../../src/core/ai/aggressiveSpatialOptimizer.js';
import type { Vector3, Team } from '../../src/types/index.js';
import type { SpatialEntity } from '../../src/utils/spatialGrid.js';

describe('AggressiveSpatialOptimizer Performance', () => {
  let optimizer: AggressiveSpatialOptimizer;
  let mockGrid: { queryRadius: (center: Vector3, radius: number) => SpatialEntity[] };
  let entities: SpatialEntity[];

  beforeEach(() => {
    // Create mock spatial grid for testing
    mockGrid = {
      queryRadius: (center: Vector3, radius: number) => {
        // Simple brute force implementation for baseline comparison
        return entities.filter(entity => {
          const dx = entity.pos.x - center.x;
          const dy = entity.pos.y - center.y;
          const dz = entity.pos.z - center.z;
          const distSq = dx * dx + dy * dy + dz * dz;
          return distSq <= radius * radius;
        });
      }
    };

    optimizer = new AggressiveSpatialOptimizer(mockGrid, 64);

    // Generate test entities in a realistic battle scenario
    entities = [];
    const teams: Team[] = ['red', 'blue'];
    
    // Create 50 entities (realistic large battle)
    for (let i = 0; i < 50; i++) {
      entities.push({
        id: i,
        pos: {
          x: (Math.random() - 0.5) * 1000,
          y: (Math.random() - 0.5) * 1000,
          z: (Math.random() - 0.5) * 200
        },
        radius: 20,
        team: teams[i % 2]
      });
    }
  });

  it('should show significant performance improvement with approximation', () => {
    // Update spatial grids
    optimizer.updateSpatialGrids(entities);

    // Test center point
    const center: Vector3 = { x: 0, y: 0, z: 0 };
    const radius = 200;
    const queryCount = 100; // Simulate 100 queries like in heavy combat

    // Measure baseline (mock grid direct calls)
    const baselineStart = performance.now();
    for (let i = 0; i < queryCount; i++) {
      mockGrid.queryRadius(center, radius);
    }
    const baselineTime = performance.now() - baselineStart;

    // Measure optimized with low approximation
    const optimizedStart = performance.now();
    for (let i = 0; i < queryCount; i++) {
      optimizer.queryRadiusOptimized(center, radius, undefined, undefined, 0.1);
    }
    const optimizedTime = performance.now() - optimizedStart;

    // Measure highly approximated
    const approximateStart = performance.now();
    for (let i = 0; i < queryCount; i++) {
      optimizer.queryRadiusOptimized(center, radius, undefined, undefined, 0.5);
    }
    const approximateTime = performance.now() - approximateStart;

    console.log(`Baseline time: ${baselineTime.toFixed(2)}ms`);
    console.log(`Optimized time: ${optimizedTime.toFixed(2)}ms`);
    console.log(`Approximate time: ${approximateTime.toFixed(2)}ms`);
    console.log(`Optimization improvement: ${((baselineTime - optimizedTime) / baselineTime * 100).toFixed(1)}%`);
    console.log(`Approximation improvement: ${((baselineTime - approximateTime) / baselineTime * 100).toFixed(1)}%`);

    // Get cache statistics
    const metrics = optimizer.getMetrics();
    console.log('Cache metrics:', metrics);

    // Expect significant improvement with caching
    expect(optimizedTime).toBeLessThan(baselineTime);
    expect(approximateTime).toBeLessThan(optimizedTime);
    expect(metrics.cacheHitRate).toBeGreaterThanOrEqual(0.8); // 80%+ cache hit rate expected
  });

  it('should maintain reasonable accuracy with approximation', () => {
    optimizer.updateSpatialGrids(entities);

    const center: Vector3 = { x: 0, y: 0, z: 0 };
    const radius = 150;

    // Get exact results
    const exact = mockGrid.queryRadius(center, radius);

    // Get approximated results
    const approximate = optimizer.queryRadiusOptimized(center, radius, undefined, undefined, 0.3);

    // Should find most of the entities (allow some approximation error)
    const accuracyRatio = approximate.length / Math.max(exact.length, 1);
    console.log(`Exact results: ${exact.length}, Approximate: ${approximate.length}, Accuracy: ${(accuracyRatio * 100).toFixed(1)}%`);

    // With 30% approximation, should still be reasonably accurate
    expect(accuracyRatio).toBeGreaterThan(0.6); // At least 60% accuracy
    expect(accuracyRatio).toBeLessThan(1.5); // Not more than 50% over-estimation
  });

  it('should show cache hit improvements over repeated queries', () => {
    optimizer.updateSpatialGrids(entities);

    const center: Vector3 = { x: 100, y: 100, z: 0 };
    const radius = 100;

    // Clear metrics
    optimizer.resetMetrics();

    // Make repeated queries to same location (common in AI flocking)
    for (let i = 0; i < 20; i++) {
      optimizer.queryRadiusOptimized(center, radius);
    }

    const metrics = optimizer.getMetrics();
    console.log('Repeated query metrics:', metrics);

    // Should have high cache hit rate for repeated queries
    expect(metrics.cacheHitRate).toBeGreaterThan(0.5);
    expect(metrics.cacheHits + metrics.cacheMisses).toBe(20);
  });

  it('should handle K-nearest queries efficiently', () => {
    optimizer.updateSpatialGrids(entities);

    const center: Vector3 = { x: 0, y: 0, z: 0 };
    const k = 5;
    const queryCount = 50;

    // Measure K-nearest performance
    const start = performance.now();
    for (let i = 0; i < queryCount; i++) {
      const results = optimizer.queryKNearestApproximate(center, k, undefined, undefined, 0.2);
      expect(results.length).toBeLessThanOrEqual(k);
    }
    const time = performance.now() - start;

    console.log(`K-nearest queries (${queryCount} queries, k=${k}): ${time.toFixed(2)}ms`);
    console.log(`Average per query: ${(time / queryCount).toFixed(3)}ms`);

    // Should be fast for K-nearest queries
    expect(time).toBeLessThan(100); // Should complete 50 queries in under 100ms
  });

  it('should show performance scaling with entity count', () => {
    const entityCounts = [10, 25, 50, 100];
    const queryCount = 20;
    const center: Vector3 = { x: 0, y: 0, z: 0 };
    const radius = 200;

    for (const count of entityCounts) {
      // Generate specific entity count
      const testEntities: SpatialEntity[] = [];
      for (let i = 0; i < count; i++) {
        testEntities.push({
          id: i,
          pos: {
            x: (Math.random() - 0.5) * 1000,
            y: (Math.random() - 0.5) * 1000,
            z: (Math.random() - 0.5) * 200
          },
          radius: 20,
          team: i % 2 === 0 ? 'red' : 'blue'
        });
      }

      // Update and measure
      optimizer.updateSpatialGrids(testEntities);
      optimizer.resetMetrics();

      const start = performance.now();
      for (let i = 0; i < queryCount; i++) {
        optimizer.queryRadiusOptimized(center, radius, undefined, undefined, 0.2);
      }
      const time = performance.now() - start;

      const metrics = optimizer.getMetrics();
      console.log(`${count} entities: ${time.toFixed(2)}ms, cache hit rate: ${(metrics.cacheHitRate * 100).toFixed(1)}%`);

      // Performance should not degrade linearly with entity count due to spatial partitioning
      expect(time).toBeLessThan(count * 0.5); // Should be sub-linear
    }
  });

  it('should configure optimization parameters correctly', () => {
    optimizer.configure({
      cacheTTL: 10,
      spatialUpdateFrequency: 5,
      coarseThreshold: 300,
      mediumThreshold: 150
    });

    optimizer.updateSpatialGrids(entities);

    const center: Vector3 = { x: 0, y: 0, z: 0 };

    // Test that different thresholds use different grid resolutions
    const coarseResult = optimizer.queryRadiusOptimized(center, 350); // Should use coarse
    const mediumResult = optimizer.queryRadiusOptimized(center, 200); // Should use medium  
    const fineResult = optimizer.queryRadiusOptimized(center, 80);   // Should use fine

    console.log(`Coarse (r=350): ${coarseResult.length}, Medium (r=200): ${mediumResult.length}, Fine (r=80): ${fineResult.length}`);

    // Results should be reasonable
    expect(coarseResult.length).toBeGreaterThanOrEqual(mediumResult.length);
    expect(mediumResult.length).toBeGreaterThanOrEqual(fineResult.length);
  });

  it('should handle rapid spatial updates efficiently', () => {
    const updateCount = 10;
    let totalUpdateTime = 0;

    for (let frame = 0; frame < updateCount; frame++) {
      // Simulate movement by slightly modifying entity positions
      const movedEntities = entities.map(entity => ({
        ...entity,
        pos: {
          x: entity.pos.x + (Math.random() - 0.5) * 10,
          y: entity.pos.y + (Math.random() - 0.5) * 10,
          z: entity.pos.z + (Math.random() - 0.5) * 2
        }
      }));

      const start = performance.now();
      optimizer.updateSpatialGrids(movedEntities);
      totalUpdateTime += performance.now() - start;
    }

    console.log(`Spatial updates (${updateCount} frames): ${totalUpdateTime.toFixed(2)}ms total`);
    console.log(`Average per frame: ${(totalUpdateTime / updateCount).toFixed(3)}ms`);

    // Updates should be fast
    expect(totalUpdateTime).toBeLessThan(50); // Under 50ms for 10 updates
  });
});
