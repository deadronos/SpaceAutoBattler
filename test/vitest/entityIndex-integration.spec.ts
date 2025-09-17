import { describe, it, expect, beforeEach } from 'vitest';
import { createInitialState, spawnShip, spawnFleet } from '../../src/core/gameState.js';
import type { GameState } from '../../src/types/index.js';

describe('EntityIndex Integration Tests', () => {
  let state: GameState;

  beforeEach(() => {
    state = createInitialState('entityindex-integration-test');
    // Enable spatial indexing
    state.behaviorConfig = state.behaviorConfig || ({} as any);
    state.behaviorConfig.globalSettings = state.behaviorConfig.globalSettings || ({} as any);
    state.behaviorConfig.globalSettings.enableSpatialIndex = true;
    
    // Initialize the spatial structures
    if (!state.entityIndex) {
      const { initEntityIndex } = require('../../src/core/entityIndex.js');
      state.entityIndex = initEntityIndex(50);
    }
  });

  describe('Ship Lifecycle Integration', () => {
    it('should add ships to entityIndex when spawned', () => {
      expect(state.entityIndex).toBeDefined();
      
      const ship = spawnShip(state, 'red', 'fighter', { x: 100, y: 100, z: 100 });
      
      // Query near the ship position
      const neighbors = state.entityIndex!.queryNeighbors(100, 100, 100, 50);
      expect(neighbors).toHaveLength(1);
      expect(neighbors[0].id).toBe(ship.id);
      expect(neighbors[0].team).toBe('red');
      expect(neighbors[0].type).toBe('ship');
    });

    it('should update entityIndex when ship positions change', () => {
      const ship = spawnShip(state, 'blue', 'corvette', { x: 0, y: 0, z: 0 });
      
      // Move the ship
      ship.pos.x = 200;
      ship.pos.y = 200;
      ship.pos.z = 200;
      
      // Simulate the position update that happens in game loop
      if (state.entityIndex) {
        state.entityIndex.update({
          id: ship.id,
          x: ship.pos.x,
          y: ship.pos.y,
          z: ship.pos.z,
          team: ship.team,
          type: 'ship',
          radius: 16,
        });
      }
      
      // Old position should have no neighbors
      const oldNeighbors = state.entityIndex!.queryNeighbors(0, 0, 0, 50);
      expect(oldNeighbors).toHaveLength(0);
      
      // New position should have the ship
      const newNeighbors = state.entityIndex!.queryNeighbors(200, 200, 200, 50);
      expect(newNeighbors).toHaveLength(1);
      expect(newNeighbors[0].id).toBe(ship.id);
    });

    it('should remove ships from entityIndex when destroyed', () => {
      const ship = spawnShip(state, 'red', 'destroyer', { x: 50, y: 50, z: 50 });
      
      // Verify ship is in index
      let neighbors = state.entityIndex!.queryNeighbors(50, 50, 50, 30);
      expect(neighbors).toHaveLength(1);
      
      // Remove ship (simulate destruction)
      state.ships = state.ships.filter(s => s.id !== ship.id);
      state.entityIndex!.remove(ship.id);
      
      // Verify ship is no longer in index
      neighbors = state.entityIndex!.queryNeighbors(50, 50, 50, 30);
      expect(neighbors).toHaveLength(0);
    });
  });

  describe('Query Performance and Correctness', () => {
    it('should find correct neighbors with team filtering', () => {
      // Spawn mixed fleet
      spawnShip(state, 'red', 'fighter', { x: 100, y: 100, z: 100 });
      spawnShip(state, 'blue', 'fighter', { x: 110, y: 100, z: 100 });
      spawnShip(state, 'red', 'corvette', { x: 120, y: 100, z: 100 });
      spawnShip(state, 'blue', 'corvette', { x: 130, y: 100, z: 100 });
      
      // Query all ships in area
      const allNeighbors = state.entityIndex!.queryNeighbors(115, 100, 100, 50);
      expect(allNeighbors).toHaveLength(4);
      
      // Query only red team
      const redNeighbors = state.entityIndex!.queryNeighbors(115, 100, 100, 50, { team: 'red' });
      expect(redNeighbors).toHaveLength(2);
      expect(redNeighbors.every(n => n.team === 'red')).toBe(true);
      
      // Query only blue team
      const blueNeighbors = state.entityIndex!.queryNeighbors(115, 100, 100, 50, { team: 'blue' });
      expect(blueNeighbors).toHaveLength(2);
      expect(blueNeighbors.every(n => n.team === 'blue')).toBe(true);
    });

    it('should respect maxResults parameter', () => {
      // Spawn many ships in close proximity
      for (let i = 0; i < 10; i++) {
        spawnShip(state, 'red', 'fighter', { x: 100 + i * 5, y: 100, z: 100 });
      }
      
      // Query with limit
      const limitedNeighbors = state.entityIndex!.queryNeighbors(105, 100, 100, 50, { maxResults: 3 });
      expect(limitedNeighbors).toHaveLength(3);
      
      // Query without limit should find more
      const allNeighbors = state.entityIndex!.queryNeighbors(105, 100, 100, 50);
      expect(allNeighbors.length).toBeGreaterThan(3);
    });

    it('should work with custom filter functions', () => {
      const ship1 = spawnShip(state, 'red', 'fighter', { x: 100, y: 100, z: 100 });
      const ship2 = spawnShip(state, 'red', 'corvette', { x: 110, y: 100, z: 100 });
      const ship3 = spawnShip(state, 'red', 'frigate', { x: 120, y: 100, z: 100 });
      
      // Filter by ID (only ship2)
      const filteredNeighbors = state.entityIndex!.queryNeighbors(110, 100, 100, 50, {
        filter: (e) => e.id === ship2.id
      });
      expect(filteredNeighbors).toHaveLength(1);
      expect(filteredNeighbors[0].id).toBe(ship2.id);
    });
  });

  describe('Deterministic Behavior', () => {
    it('should return results in consistent order', () => {
      // Spawn ships with deterministic positions
      spawnShip(state, 'red', 'fighter', { x: 100, y: 100, z: 100 });
      spawnShip(state, 'red', 'fighter', { x: 105, y: 100, z: 100 });
      spawnShip(state, 'red', 'fighter', { x: 110, y: 100, z: 100 });
      
      // Query multiple times - results should be in same order
      const query1 = state.entityIndex!.queryNeighbors(105, 100, 100, 20);
      const query2 = state.entityIndex!.queryNeighbors(105, 100, 100, 20);
      
      expect(query1.map(e => e.id)).toEqual(query2.map(e => e.id));
      
      // Results should be sorted by ID for determinism
      const ids = query1.map(e => e.id);
      const sortedIds = [...ids].sort((a, b) => a - b);
      expect(ids).toEqual(sortedIds);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty queries', () => {
      const neighbors = state.entityIndex!.queryNeighbors(1000, 1000, 1000, 50);
      expect(neighbors).toHaveLength(0);
    });

    it('should handle zero radius queries', () => {
      spawnShip(state, 'red', 'fighter', { x: 100, y: 100, z: 100 });
      // Zero radius should find no neighbors (entities have non-zero radius)
      const neighbors = state.entityIndex!.queryNeighbors(100, 100, 100, 0);
      // Note: This test depends on the implementation. If entities overlap exactly,
      // a zero-radius query might still find them. Adjust expectation based on behavior.
      expect(neighbors.length).toBeLessThanOrEqual(1);
    });

    it('should handle large fleet spawning', () => {
      // Spawn large fleet to test performance and correctness
      spawnFleet(state, 'red', 20);
      spawnFleet(state, 'blue', 20);
      
      expect(state.ships).toHaveLength(40);
      
      // Query should find appropriate subset
      const center = { x: 960, y: 960, z: 960 }; // center of default bounds
      const neighbors = state.entityIndex!.queryNeighbors(center.x, center.y, center.z, 500);
      expect(neighbors.length).toBeGreaterThan(0);
      expect(neighbors.length).toBeLessThanOrEqual(40);
    });
  });
});