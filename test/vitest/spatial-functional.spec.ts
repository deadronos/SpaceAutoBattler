import { describe, it, expect, beforeEach } from 'vitest';
import { createInitialState, spawnShip, simulateStep } from '../../src/core/gameState.js';
import { AIController } from '../../src/core/aiController.js';
import type { GameState } from '../../src/types/index.js';

describe('Spatial Index Functional Verification', () => {
  let state: GameState;
  let aiController: AIController;

  beforeEach(() => {
    state = createInitialState('test-seed');
    aiController = new AIController(state);
  });

  it('should use spatial index by default and provide correct results', () => {
    // Verify spatial index is enabled by default
    expect(state.behaviorConfig?.globalSettings.enableSpatialIndex).toBe(true);
    expect(state.spatialGrid).toBeDefined();

    // Create a test scenario with specific ship positions
    const ship1 = spawnShip(state, 'red', 'fighter', { x: 500, y: 500, z: 300 });
    const ship2 = spawnShip(state, 'red', 'fighter', { x: 550, y: 500, z: 300 }); // 50 units away
    const ship3 = spawnShip(state, 'red', 'fighter', { x: 700, y: 500, z: 300 }); // 200 units away
    const ship4 = spawnShip(state, 'blue', 'fighter', { x: 520, y: 500, z: 300 }); // Enemy, 20 units away

    // Populate spatial index directly to avoid running full AI simulation in tests
    if (state.spatialGrid) {
      state.spatialGrid.rebuild(state.ships.map(s => ({ id: s.id, pos: s.pos, radius: 16, team: s.team })));
    }

    // Verify spatial index has entities
    const stats = state.spatialGrid!.getStats();
    expect(stats.totalEntities).toBe(4);

    // Test separation force calculation uses spatial index
    const separationResult = aiController.calculateSeparationForceWithCount(ship1);
    
    // Should find at least one neighbor (ship2 is 50 units away, within default separation distance of 120)
    expect(separationResult.neighborCount).toBeGreaterThan(0);
    
    // Force should be non-zero (pointing away from neighbors)
    const forceMagnitude = Math.sqrt(
      separationResult.force.x ** 2 + 
      separationResult.force.y ** 2 + 
      separationResult.force.z ** 2
    );
    expect(forceMagnitude).toBeGreaterThan(0);
  });

  it('should provide identical results when spatial index is disabled', () => {
    // Create test scenario
    const ship1 = spawnShip(state, 'red', 'fighter', { x: 500, y: 500, z: 300 });
    const ship2 = spawnShip(state, 'red', 'fighter', { x: 550, y: 500, z: 300 });
    const ship3 = spawnShip(state, 'blue', 'fighter', { x: 520, y: 500, z: 300 });

    // Test with spatial index enabled (populate index directly)
    state.behaviorConfig!.globalSettings.enableSpatialIndex = true;
    if (state.spatialGrid) {
      state.spatialGrid.rebuild(state.ships.map(s => ({ id: s.id, pos: s.pos, radius: 16, team: s.team })));
    }
    const resultWithIndex = aiController.calculateSeparationForceWithCount(ship1);

    // Test with spatial index disabled
    state.behaviorConfig!.globalSettings.enableSpatialIndex = false;
    const resultWithoutIndex = aiController.calculateSeparationForceWithCount(ship1);

    // Results should be identical
    expect(resultWithIndex.neighborCount).toBe(resultWithoutIndex.neighborCount);
    expect(Math.abs(resultWithIndex.force.x - resultWithoutIndex.force.x)).toBeLessThan(0.001);
    expect(Math.abs(resultWithIndex.force.y - resultWithoutIndex.force.y)).toBeLessThan(0.001);
    expect(Math.abs(resultWithIndex.force.z - resultWithoutIndex.force.z)).toBeLessThan(0.001);
  });

  it('should handle large numbers of entities without errors', () => {
    // Spawn many ships to test scalability
    const shipCount = 500;
    for (let i = 0; i < shipCount; i++) {
      const x = Math.random() * 1000 + 200;
      const y = Math.random() * 600 + 200;
      const z = Math.random() * 400 + 100;
      const team = i % 2 === 0 ? 'red' : 'blue';
      spawnShip(state, team, 'fighter', { x, y, z });
    }

    // Populate spatial index directly and verify it doesn't crash
    if (state.spatialGrid) {
      expect(() => {
        state.spatialGrid.rebuild(state.ships.map(s => ({ id: s.id, pos: s.pos, radius: 16, team: s.team })));
      }).not.toThrow();
      const stats = state.spatialGrid!.getStats();
      expect(stats.totalEntities).toBe(shipCount);
    }

    // Test that AI calculations work with large entity count
    const testShip = state.ships[0];
    expect(() => {
      aiController.calculateSeparationForceWithCount(testShip);
    }).not.toThrow();
  });

  it('should correctly query different types of spatial relationships', () => {
    // Create a controlled layout
    const centerShip = spawnShip(state, 'red', 'fighter', { x: 500, y: 500, z: 300 });
    
    // Nearby red ships (neighbors)
    spawnShip(state, 'red', 'fighter', { x: 520, y: 500, z: 300 });
    spawnShip(state, 'red', 'fighter', { x: 480, y: 520, z: 300 });
    
    // Nearby blue ships (enemies)
    spawnShip(state, 'blue', 'fighter', { x: 530, y: 490, z: 300 });
    spawnShip(state, 'blue', 'fighter', { x: 470, y: 510, z: 300 });
    
    // Distant ships (shouldn't affect separation)
    spawnShip(state, 'red', 'fighter', { x: 800, y: 500, z: 300 });
    spawnShip(state, 'blue', 'fighter', { x: 200, y: 500, z: 300 });

    // Populate spatial index directly for deterministic queries
    if (state.spatialGrid) {
      state.spatialGrid.rebuild(state.ships.map(s => ({ id: s.id, pos: s.pos, radius: 16, team: s.team })));
    }

    // Test spatial queries directly
    if (state.spatialGrid) {
      // Should find nearby neighbors within separation distance
      const neighbors = state.spatialGrid.queryNeighbors(centerShip.pos, 120, 'red', centerShip.id);
      expect(neighbors.length).toBe(2); // Two nearby red ships

      // Should find nearby enemies
      const enemies = state.spatialGrid.queryEnemies(centerShip.pos, 120, 'red');
      expect(enemies.length).toBe(2); // Two nearby blue ships

      // Should find fewer entities with smaller radius
      const closeNeighbors = state.spatialGrid.queryNeighbors(centerShip.pos, 50, 'red', centerShip.id);
      expect(closeNeighbors.length).toBeLessThanOrEqual(neighbors.length);
    }

    // Test AI integration
    const separationResult = aiController.calculateSeparationForceWithCount(centerShip);
    expect(separationResult.neighborCount).toBe(2); // Should find 2 nearby red ships
  });

  it('should demonstrate performance characteristics', () => {
    // Create moderate number of entities
    const entityCount = 200;
    for (let i = 0; i < entityCount; i++) {
      const x = Math.random() * 800 + 100;
      const y = Math.random() * 600 + 100;
      const z = Math.random() * 400 + 100;
      const team = i % 2 === 0 ? 'red' : 'blue';
      spawnShip(state, team, 'fighter', { x, y, z });
    }

    const testShip = state.ships[50];

    // Test that spatial index method completes quickly
    const startTime = performance.now();
    state.behaviorConfig!.globalSettings.enableSpatialIndex = true;
    if (state.spatialGrid) {
      state.spatialGrid.rebuild(state.ships.map(s => ({ id: s.id, pos: s.pos, radius: 16, team: s.team })));
    }
    
    for (let i = 0; i < 50; i++) {
      aiController.calculateSeparationForceWithCount(testShip);
    }
    const spatialTime = performance.now() - startTime;

    // Test that linear method also completes (but potentially slower)
    const startLinearTime = performance.now();
    state.behaviorConfig!.globalSettings.enableSpatialIndex = false;
    
    for (let i = 0; i < 50; i++) {
      aiController.calculateSeparationForceWithCount(testShip);
    }
    const linearTime = performance.now() - startLinearTime;

    // Both should complete successfully
    expect(spatialTime).toBeGreaterThan(0);
    expect(linearTime).toBeGreaterThan(0);

    // Performance improvement is nice but not required for correctness
    console.log(`Performance comparison with ${entityCount} entities:`);
    console.log(`  Spatial index: ${spatialTime.toFixed(2)}ms`);
    console.log(`  Linear search: ${linearTime.toFixed(2)}ms`);
    if (linearTime > spatialTime) {
      console.log(`  Speedup: ${(linearTime / spatialTime).toFixed(2)}x`);
    } else {
      console.log(`  No significant performance difference measured`);
    }

    // The main requirement is that spatial index doesn't break functionality
    expect(spatialTime).toBeLessThan(1000); // Should be fast enough
    expect(linearTime).toBeLessThan(1000);
  });
});
