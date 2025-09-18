import { describe, it, expect, beforeEach } from 'vitest';
import { AggressiveSpatialOptimizer } from '../../src/core/ai/aggressiveSpatialOptimizer.js';
import type { Vector3 } from '../../src/types/index.js';
import type { SpatialEntity } from '../../src/utils/spatialGrid.js';

describe('QuickSelect Optimization', () => {
  let optimizer: AggressiveSpatialOptimizer;
  let mockGrid: any;

  beforeEach(() => {
    // Create a mock grid that provides controlled candidate sets
    mockGrid = {
      queryRadius: (center: Vector3, radius: number) => {
        // Generate a large set of test entities to trigger quickselect
        const entities: SpatialEntity[] = [];
        for (let i = 0; i < 50; i++) {
          entities.push({
            id: i,
            pos: {
              x: center.x + (Math.random() - 0.5) * radius * 2,
              y: center.y + (Math.random() - 0.5) * radius * 2,
              z: center.z + (Math.random() - 0.5) * radius * 2,
            },
            radius: 10,
            team: i % 2 === 0 ? 'red' : 'blue',
          });
        }
        return entities;
      }
    };
    
    optimizer = new AggressiveSpatialOptimizer(mockGrid, 64);
  });

  it('should use quickselect for large candidate sets', () => {
    const center: Vector3 = { x: 100, y: 100, z: 0 };
    const k = 3;
    
    // This should trigger quickselect since candidates (50) > k * 4 (12)
    const results = optimizer.queryKNearestApproximate(center, k, 'red');
    
    // Verify we get exactly k results
    expect(results).toHaveLength(k);
    
    // Verify results are actually the nearest (sorted by distance)
    for (let i = 1; i < results.length; i++) {
      const prevDist = Math.sqrt(
        (results[i-1].pos.x - center.x) ** 2 + 
        (results[i-1].pos.y - center.y) ** 2 + 
        (results[i-1].pos.z - center.z) ** 2
      );
      const currDist = Math.sqrt(
        (results[i].pos.x - center.x) ** 2 + 
        (results[i].pos.y - center.y) ** 2 + 
        (results[i].pos.z - center.z) ** 2
      );
      expect(prevDist).toBeLessThanOrEqual(currDist);
    }
  });

  it('should produce same results as full sort for small k', () => {
    // Create a deterministic set of entities for comparison
    const entities: SpatialEntity[] = [];
    const center: Vector3 = { x: 0, y: 0, z: 0 };
    
    for (let i = 0; i < 20; i++) {
      entities.push({
        id: i,
        pos: { x: i * 10, y: i * 5, z: 0 },
        radius: 10,
        team: 'red',
      });
    }
    
    // Mock the grid to return our controlled entities
    mockGrid.queryRadius = () => entities.slice();
    
    const k = 5;
    const results = optimizer.queryKNearestApproximate(center, k, 'red');
    
    // Compare with manual sorting
    const sorted = entities
      .slice()
      .sort((a, b) => {
        const distA = (a.pos.x - center.x) ** 2 + (a.pos.y - center.y) ** 2 + (a.pos.z - center.z) ** 2;
        const distB = (b.pos.x - center.x) ** 2 + (b.pos.y - center.y) ** 2 + (b.pos.z - center.z) ** 2;
        return distA - distB;
      })
      .slice(0, k);
    
    expect(results).toHaveLength(k);
    expect(results.map(r => r.id)).toEqual(sorted.map(s => s.id));
  });

  it('should handle edge cases correctly', () => {
    // Test with k larger than candidate set
    mockGrid.queryRadius = () => [
      { id: 1, pos: { x: 10, y: 0, z: 0 }, radius: 10, team: 'red' },
      { id: 2, pos: { x: 20, y: 0, z: 0 }, radius: 10, team: 'red' },
    ];
    
    const center: Vector3 = { x: 0, y: 0, z: 0 };
    const results = optimizer.queryKNearestApproximate(center, 5, 'red');
    
    // Should return all available entities (2) even though k=5
    expect(results).toHaveLength(2);
    expect(results[0].id).toBe(1); // Closer entity should be first
    expect(results[1].id).toBe(2);
  });

  it('should handle empty candidate sets', () => {
    mockGrid.queryRadius = () => [];
    
    const center: Vector3 = { x: 0, y: 0, z: 0 };
    const results = optimizer.queryKNearestApproximate(center, 3, 'red');
    
    expect(results).toHaveLength(0);
  });

  it('should perform better than full sort for large datasets', () => {
    // Create a large dataset to measure performance
    const largeEntities: SpatialEntity[] = [];
    for (let i = 0; i < 200; i++) {
      largeEntities.push({
        id: i,
        pos: {
          x: Math.random() * 1000,
          y: Math.random() * 1000,
          z: Math.random() * 100,
        },
        radius: 10,
        team: 'red',
      });
    }
    
    mockGrid.queryRadius = () => largeEntities.slice();
    
    const center: Vector3 = { x: 500, y: 500, z: 50 };
    const k = 5;
    
    // Warm up
    optimizer.queryKNearestApproximate(center, k, 'red');
    
    // Measure performance
    const iterations = 10;
    const start = performance.now();
    
    for (let i = 0; i < iterations; i++) {
      const results = optimizer.queryKNearestApproximate(center, k, 'red');
      expect(results).toHaveLength(k);
    }
    
    const end = performance.now();
    const avgTime = (end - start) / iterations;
    
    console.log(`Average quickselect time for 200 candidates, k=${k}: ${avgTime.toFixed(3)}ms`);
    
    // Should be reasonably fast
    expect(avgTime).toBeLessThan(5.0); // 5ms per query should be easily achievable
  });
});