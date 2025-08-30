import { describe, it, expect, beforeEach } from 'vitest';
import { createInitialState, spawnShip, simulateStep } from '../../src/core/gameState.js';
import { AIController } from '../../src/core/aiController.js';
import type { GameState } from '../../src/types/index.js';

describe('Spatial Index Performance Benchmark', () => {
  let state: GameState;
  let aiController: AIController;

  beforeEach(() => {
    state = createInitialState('benchmark-seed');
    aiController = new AIController(state);
  });

  it('should provide significant speedup for neighbor queries at 500+ entities', () => {
    // Create a dense cluster of ships to maximize neighbor queries
    const shipCount = 500;
    const clusterRadius = 300; // Tight cluster to ensure many neighbors
    
    // Spawn ships in a cluster
    for (let i = 0; i < shipCount; i++) {
      const angle = (i / shipCount) * Math.PI * 2;
      const radius = Math.random() * clusterRadius;
      const x = 500 + Math.cos(angle) * radius;
      const y = 500 + Math.sin(angle) * radius;
      const z = 300 + (Math.random() - 0.5) * 100;
      const team = i % 2 === 0 ? 'red' : 'blue';
      
      spawnShip(state, team, 'fighter', { x, y, z });
    }

    // Ensure spatial index is enabled
    state.behaviorConfig!.globalSettings.enableSpatialIndex = true;
    
    // Warm up - run one simulation step to populate spatial index
    simulateStep(state, 0.1);

    // Benchmark with spatial index enabled
    const startTimeWithIndex = performance.now();
    for (let i = 0; i < 10; i++) {
      simulateStep(state, 0.1);
    }
    const endTimeWithIndex = performance.now();
    const timeWithSpatialIndex = endTimeWithIndex - startTimeWithIndex;

    // Now disable spatial index and benchmark linear search
    state.behaviorConfig!.globalSettings.enableSpatialIndex = false;
    state.spatialGrid = undefined; // Force fallback to linear search

    const startTimeLinear = performance.now();
    for (let i = 0; i < 10; i++) {
      simulateStep(state, 0.1);
    }
    const endTimeLinear = performance.now();
    const timeWithLinearSearch = endTimeLinear - startTimeLinear;

    // Calculate speedup ratio
    const speedupRatio = timeWithLinearSearch / timeWithSpatialIndex;

    console.log(`Benchmark Results for ${shipCount} entities:`);
    console.log(`  Linear search time: ${timeWithLinearSearch.toFixed(2)}ms`);
    console.log(`  Spatial index time: ${timeWithSpatialIndex.toFixed(2)}ms`);
    console.log(`  Speedup ratio: ${speedupRatio.toFixed(2)}x`);

    // Verify that spatial index provides at least 2x speedup as required
    expect(speedupRatio).toBeGreaterThanOrEqual(2.0);
  }, 30000); // 30 second timeout for benchmark

  it('should handle edge cases correctly with spatial index', () => {
    // Test with very few ships
    spawnShip(state, 'red', 'fighter', { x: 100, y: 100, z: 100 });
    spawnShip(state, 'blue', 'fighter', { x: 200, y: 100, z: 100 });

    // Should not crash with spatial index enabled
    expect(() => {
      simulateStep(state, 0.1);
    }).not.toThrow();

    // Test with ships at boundaries
    spawnShip(state, 'red', 'fighter', { x: 0, y: 0, z: 0 });
    spawnShip(state, 'blue', 'fighter', { x: 1920, y: 1080, z: 600 });

    expect(() => {
      simulateStep(state, 0.1);
    }).not.toThrow();
  });

  it('should provide correct query results regardless of index usage', () => {
    // Create a specific scenario with known neighbor relationships
    const ship1 = spawnShip(state, 'red', 'fighter', { x: 500, y: 500, z: 300 });
    const ship2 = spawnShip(state, 'red', 'fighter', { x: 550, y: 500, z: 300 }); // 50 units away
    const ship3 = spawnShip(state, 'red', 'fighter', { x: 600, y: 500, z: 300 }); // 100 units away
    const ship4 = spawnShip(state, 'blue', 'fighter', { x: 520, y: 500, z: 300 }); // Enemy, 20 units away

    // Test with spatial index enabled
    state.behaviorConfig!.globalSettings.enableSpatialIndex = true;
    simulateStep(state, 0.1); // Populate spatial index
    
    const separationWithIndex = aiController.calculateSeparationForceWithCount(ship1);

    // Test with spatial index disabled
    state.behaviorConfig!.globalSettings.enableSpatialIndex = false;
    state.spatialGrid = undefined;
    
    const separationLinear = aiController.calculateSeparationForceWithCount(ship1);

    // Results should be very similar (within floating point precision)
    expect(Math.abs(separationWithIndex.neighborCount - separationLinear.neighborCount)).toBeLessThanOrEqual(1);
    expect(Math.abs(separationWithIndex.force.x - separationLinear.force.x)).toBeLessThan(0.01);
    expect(Math.abs(separationWithIndex.force.y - separationLinear.force.y)).toBeLessThan(0.01);
    expect(Math.abs(separationWithIndex.force.z - separationLinear.force.z)).toBeLessThan(0.01);
  });

  it('should scale efficiently with entity count', () => {
    const entityCounts = [100, 250, 500, 1000];
    const spatialTimes: number[] = [];
    const linearTimes: number[] = [];

    for (const count of entityCounts) {
      // Reset state
      state = createInitialState('scale-test');
      aiController = new AIController(state);

      // Spawn entities
      for (let i = 0; i < count; i++) {
        const x = Math.random() * 1000 + 100;
        const y = Math.random() * 800 + 100;
        const z = Math.random() * 400 + 100;
        const team = i % 2 === 0 ? 'red' : 'blue';
        spawnShip(state, team, 'fighter', { x, y, z });
      }

      // Test spatial index
      state.behaviorConfig!.globalSettings.enableSpatialIndex = true;
      simulateStep(state, 0.1); // Warm up

      const startSpatial = performance.now();
      for (let i = 0; i < 5; i++) {
        simulateStep(state, 0.1);
      }
      const endSpatial = performance.now();
      spatialTimes.push(endSpatial - startSpatial);

      // Test linear search
      state.behaviorConfig!.globalSettings.enableSpatialIndex = false;
      state.spatialGrid = undefined;

      const startLinear = performance.now();
      for (let i = 0; i < 5; i++) {
        simulateStep(state, 0.1);
      }
      const endLinear = performance.now();
      linearTimes.push(endLinear - startLinear);
    }

    console.log('\nScaling Benchmark Results:');
    for (let i = 0; i < entityCounts.length; i++) {
      const speedup = linearTimes[i] / spatialTimes[i];
      console.log(`  ${entityCounts[i]} entities: ${speedup.toFixed(2)}x speedup`);
    }

    // Verify that speedup improves with entity count (spatial index scales better)
    const speedup500 = linearTimes[2] / spatialTimes[2]; // 500 entities
    const speedup1000 = linearTimes[3] / spatialTimes[3]; // 1000 entities
    
    expect(speedup500).toBeGreaterThanOrEqual(2.0);
    expect(speedup1000).toBeGreaterThanOrEqual(speedup500);
  }, 60000); // 60 second timeout for scaling test
});