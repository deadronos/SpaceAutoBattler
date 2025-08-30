import { describe, it, expect, beforeEach } from 'vitest';
import { createInitialState, spawnShip, simulateStep } from '../../src/core/gameState.js';
import { populateSpatialGridForTest } from './helpers/populateSpatialGrid.js';
import { AIController } from '../../src/core/aiController.js';
import type { GameState } from '../../src/types/index.js';

describe('Spatial Index Performance Benchmark', () => {
  let state: GameState;
  let aiController: AIController;

  beforeEach(() => {
    state = createInitialState('benchmark-seed');
    aiController = new AIController(state);
  });

  it('should compare neighbor query runtimes at 500+ entities', () => {
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
    
  // Warm up: populate spatial index directly to avoid extra AI work before benchmarking
  populateSpatialGridForTest(state);

    // Benchmark separation calculation with spatial index enabled
    const sampleShips = state.ships.slice(0, 50);
    const iterations = 20; // 50 * 20 = 1000 separation queries
    state.behaviorConfig!.globalSettings.enableSpatialIndex = true;
    populateSpatialGridForTest(state);
    const startTimeWithIndex = performance.now();
    for (let it = 0; it < iterations; it++) {
      for (const ship of sampleShips) {
        aiController.calculateSeparationForceWithCount(ship);
      }
    }
    const timeWithSpatialIndex = performance.now() - startTimeWithIndex;

    // Now disable spatial index and benchmark the same calculations linearly
    state.behaviorConfig!.globalSettings.enableSpatialIndex = false;
    const startTimeLinear = performance.now();
    for (let it = 0; it < iterations; it++) {
      for (const ship of sampleShips) {
        aiController.calculateSeparationForceWithCount(ship);
      }
    }
    const timeWithLinearSearch = performance.now() - startTimeLinear;

    // Calculate speedup ratio
    const speedupRatio = timeWithLinearSearch / timeWithSpatialIndex;

    console.log(`Benchmark Results for ${shipCount} entities:`);
    console.log(`  Linear search time: ${timeWithLinearSearch.toFixed(2)}ms`);
    console.log(`  Spatial index time: ${timeWithSpatialIndex.toFixed(2)}ms`);
    console.log(`  Speedup ratio: ${speedupRatio.toFixed(2)}x`);

    // Sanity checks only to keep benchmark non-flaky in CI environments
    expect(Number.isFinite(timeWithSpatialIndex)).toBe(true);
    expect(Number.isFinite(timeWithLinearSearch)).toBe(true);
    expect(timeWithSpatialIndex).toBeGreaterThan(0);
    expect(timeWithLinearSearch).toBeGreaterThan(0);
  }, 15000); // Keep benchmark tight to avoid CI timeouts

  it('should handle edge cases correctly with spatial index', () => {
    // Test with very few ships
    spawnShip(state, 'red', 'fighter', { x: 100, y: 100, z: 100 });
    spawnShip(state, 'blue', 'fighter', { x: 200, y: 100, z: 100 });

    // Should not crash when populating spatial index
    expect(() => populateSpatialGridForTest(state)).not.toThrow();

    // Test with ships at boundaries
    spawnShip(state, 'red', 'fighter', { x: 0, y: 0, z: 0 });
    spawnShip(state, 'blue', 'fighter', { x: 1920, y: 1080, z: 600 });

    expect(() => populateSpatialGridForTest(state)).not.toThrow();
  });

  it('should provide correct query results regardless of index usage', () => {
    // Create a specific scenario with known neighbor relationships
    const ship1 = spawnShip(state, 'red', 'fighter', { x: 500, y: 500, z: 300 });
    const ship2 = spawnShip(state, 'red', 'fighter', { x: 550, y: 500, z: 300 }); // 50 units away
    const ship3 = spawnShip(state, 'red', 'fighter', { x: 600, y: 500, z: 300 }); // 100 units away
    const ship4 = spawnShip(state, 'blue', 'fighter', { x: 520, y: 500, z: 300 }); // Enemy, 20 units away

  // Test with spatial index enabled
  state.behaviorConfig!.globalSettings.enableSpatialIndex = true;
  populateSpatialGridForTest(state); // Populate spatial index
    
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

  it('should report scaling trends with entity count', () => {
    const entityCounts = [200, 500, 800];
    const spatialTimes: number[] = [];
    const linearTimes: number[] = [];

    for (const count of entityCounts) {
      // Reset state
      state = createInitialState('scale-test');
      aiController = new AIController(state);

      // Spawn entities on a grid to reduce variance
      const spacing = 32;
      for (let i = 0; i < count; i++) {
        const gx = i % 64;
        const gy = Math.floor(i / 64);
        const x = 100 + gx * spacing;
        const y = 100 + gy * spacing;
        const z = 0;
        const team = i % 2 === 0 ? 'red' : 'blue';
        spawnShip(state, team, 'fighter', { x, y, z });
      }

      // Prepare sample subset
      const sample = state.ships.slice(0, Math.min(50, state.ships.length));
      const iterations = 10;

      // Spatial index enabled
      state.behaviorConfig!.globalSettings.enableSpatialIndex = true;
      populateSpatialGridForTest(state);
      const startSpatial = performance.now();
      for (let it = 0; it < iterations; it++) {
        for (const s of sample) aiController.calculateSeparationForceWithCount(s);
      }
      spatialTimes.push(performance.now() - startSpatial);

      // Linear mode
      state.behaviorConfig!.globalSettings.enableSpatialIndex = false;
      const startLinear = performance.now();
      for (let it = 0; it < iterations; it++) {
        for (const s of sample) aiController.calculateSeparationForceWithCount(s);
      }
      linearTimes.push(performance.now() - startLinear);
    }

    console.log('\nScaling Benchmark Results:');
    for (let i = 0; i < entityCounts.length; i++) {
      const speedup = linearTimes[i] / spatialTimes[i];
      console.log(`  ${entityCounts[i]} entities: ${speedup.toFixed(2)}x speedup`);
    }

    // Report-only: ensure timings are sane and non-zero
    for (let i = 0; i < entityCounts.length; i++) {
      expect(Number.isFinite(spatialTimes[i])).toBe(true);
      expect(Number.isFinite(linearTimes[i])).toBe(true);
      expect(spatialTimes[i]).toBeGreaterThan(0);
      expect(linearTimes[i]).toBeGreaterThan(0);
    }
  }, 30000);
});