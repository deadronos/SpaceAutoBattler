import { describe, it, expect, beforeEach } from 'vitest';
import { createInitialState, spawnShip } from '../../src/core/gameState.js';
import { AIController } from '../../src/core/aiController.js';
import type { GameState } from '../../src/types/index.js';

describe('Spatial Index Integration Tests', () => {
  let state: GameState;
  let aiController: AIController;

  beforeEach(() => {
    state = createInitialState('test-seed');
    aiController = new AIController(state);
  });

  it('should create spatial grid when enabled', () => {
    expect(state.spatialGrid).toBeDefined();
    expect(state.behaviorConfig?.globalSettings.enableSpatialIndex).toBe(true);
  });

  it('should populate spatial grid with ships', () => {
    // Spawn a couple of ships
    const ship1 = spawnShip(state, 'red', 'fighter', { x: 100, y: 100, z: 100 });
    const ship2 = spawnShip(state, 'red', 'fighter', { x: 150, y: 100, z: 100 });

    // Manually trigger spatial grid update (normally done in simulateStep)
    if (state.spatialGrid) {
      state.spatialGrid.clear();
      for (const ship of state.ships) {
        if (ship.health > 0) {
          state.spatialGrid.insert({
            id: ship.id,
            pos: ship.pos,
            radius: 16,
            team: ship.team
          });
        }
      }

      // Check that spatial grid has entities
      const stats = state.spatialGrid.getStats();
      expect(stats.totalEntities).toBe(2);

      // Check that we can query neighbors
      const neighbors = state.spatialGrid.queryNeighbors(ship1.pos, 120, 'red', ship1.id);
      expect(neighbors).toHaveLength(1);
      expect(neighbors[0].id).toBe(ship2.id);
    }
  });

  it('should use spatial index in separation force calculation', () => {
    // Create ships close together
    const ship1 = spawnShip(state, 'red', 'fighter', { x: 100, y: 100, z: 100 });
    const ship2 = spawnShip(state, 'red', 'fighter', { x: 150, y: 100, z: 100 });

    // Manually trigger spatial grid update
    if (state.spatialGrid) {
      state.spatialGrid.clear();
      for (const ship of state.ships) {
        if (ship.health > 0) {
          state.spatialGrid.insert({
            id: ship.id,
            pos: ship.pos,
            radius: 16,
            team: ship.team
          });
        }
      }
    }

    // Test separation force calculation
    const result = aiController.calculateSeparationForceWithCount(ship1);
    expect(result.neighborCount).toBeGreaterThan(0);
    expect(Math.abs(result.force.x) + Math.abs(result.force.y) + Math.abs(result.force.z)).toBeGreaterThan(0);
  });
});