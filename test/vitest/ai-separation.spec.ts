import { describe, test, expect, beforeEach } from 'vitest';
import type { GameState, Ship, Vector3 } from '../../src/types/index.js';
import { AIController } from '../../src/core/aiController.js';
import { DEFAULT_BEHAVIOR_CONFIG } from '../../src/config/behaviorConfig.js';
import { DefaultSimConfig } from '../../src/config/simConfig.js';
import { createInitialState, spawnShip } from '../../src/core/gameState.js';
import { createRNG } from '../../src/utils/rng.js';

/**
 * AI Separation Tests
 * Tests separation steering to reduce clumping while maintaining formation cohesion
 */

describe('AI Separation Steering', () => {
  let gameState: GameState;
  let aiController: AIController;

  beforeEach(() => {
    // Create proper game state using the game's initialization function
    gameState = createInitialState();
    // Override random seed for deterministic tests
    gameState.rng = createRNG('test-12345');
    // Ensure we have behavior config
    gameState.behaviorConfig = { ...DEFAULT_BEHAVIOR_CONFIG };
    // Clear any default ships
    gameState.ships = [];
    
    aiController = new AIController(gameState);
  });

  test('should reduce neighbor clumping with separation force', () => {
    // Create 10 frigates clustered together at the center (frigates have formation mode)
    const centerPos: Vector3 = { x: 500, y: 500, z: 250 };
    const clusterRadius = 30; // Start ships very close together
    const separationDistance = gameState.behaviorConfig!.globalSettings.separationDistance;

    for (let i = 0; i < 10; i++) {
      const angle = (i / 10) * Math.PI * 2;
      const shipPos: Vector3 = {
        x: centerPos.x + Math.cos(angle) * clusterRadius,
        y: centerPos.y + Math.sin(angle) * clusterRadius,
        z: centerPos.z
      };
      
      // Use frigates since they have formation mode which naturally leads to group behavior
      const ship = spawnShip(gameState, 'red', 'frigate', shipPos);
      
      // Don't manually set intent - let the AI naturally choose group behavior
      // Just make sure they have long intent duration to prevent too frequent switches
      if (ship.aiState) {
        ship.aiState.intentEndTime = gameState.time + 20; // Long duration
        ship.aiState.lastIntentReevaluation = gameState.time;
      }
    }

    // Count initial neighbors within separationDistance/2 (baseline)
    const countNeighborsInRadius = (ship: Ship, radius: number): number => {
      let count = 0;
      for (const other of gameState.ships) {
        if (other.id !== ship.id && other.team === ship.team && other.health > 0) {
          const dx = ship.pos.x - other.pos.x;
          const dy = ship.pos.y - other.pos.y;
          const dz = ship.pos.z - other.pos.z;
          const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
          if (dist <= radius) count++;
        }
      }
      return count;
    };

    const initialNeighborCounts = gameState.ships.map(ship => 
      countNeighborsInRadius(ship, separationDistance / 2)
    );
    const initialAvgNeighbors = initialNeighborCounts.reduce((a, b) => a + b, 0) / initialNeighborCounts.length;

    // Simulate for 5 seconds with small time steps to allow separation to work
    const dt = 0.1; // 100ms steps
    const totalTime = 5.0; // 5 seconds
    
    for (let t = 0; t < totalTime; t += dt) {
      gameState.time = t;
      aiController.updateAllShips(dt);
    }

    // Count final neighbors within separationDistance/2
    const finalNeighborCounts = gameState.ships.map(ship => 
      countNeighborsInRadius(ship, separationDistance / 2)
    );
    const finalAvgNeighbors = finalNeighborCounts.reduce((a, b) => a + b, 0) / finalNeighborCounts.length;

    // Calculate reduction percentage
    const reductionPercent = ((initialAvgNeighbors - finalAvgNeighbors) / initialAvgNeighbors) * 100;

    // Assert at least 50% reduction in close neighbors as specified in acceptance criteria
    expect(finalAvgNeighbors).toBeLessThan(initialAvgNeighbors);
    expect(reductionPercent).toBeGreaterThanOrEqual(50);
  });

  test('should maintain formation cohesion while applying separation', () => {
    // Create a formation of 5 ships in line formation
    const formationCenter: Vector3 = { x: 400, y: 400, z: 250 };
    const formationSpacing = 100;
    
    for (let i = 0; i < 5; i++) {
      const shipPos: Vector3 = {
        x: formationCenter.x + (i - 2) * 50, // Start slightly clustered
        y: formationCenter.y,
        z: formationCenter.z
      };
      
      const ship = spawnShip(gameState, 'blue', 'frigate', shipPos);

      // Frigates naturally use formation behavior, so let them choose their own intent
      // But set up the formation position they should target
      if (ship.aiState) {
        ship.aiState.intentEndTime = gameState.time + 20; // Long duration
        ship.aiState.lastIntentReevaluation = gameState.time;
        ship.aiState.formationPosition = {
          x: formationCenter.x + (i - 2) * formationSpacing,
          y: formationCenter.y,
          z: formationCenter.z
        };
        ship.aiState.formationId = 'line'; // Set formation ID for consistency
      }
    }

    // Simulate for 3 seconds to reach formation
    const dt = 0.1;
    const totalTime = 3.0;
    
    for (let t = 0; t < totalTime; t += dt) {
      gameState.time = t;
      aiController.updateAllShips(dt);
    }

    // Verify ships have moved towards their formation positions
    for (let i = 0; i < gameState.ships.length; i++) {
      const ship = gameState.ships[i];
      const expectedPos = ship.aiState?.formationPosition;
      
      // Skip ships without formation positions
      if (!expectedPos) {
        continue;
      }
      
      const dx = ship.pos.x - expectedPos.x;
      const dy = ship.pos.y - expectedPos.y;
      const dz = ship.pos.z - expectedPos.z;
      const distanceToFormationSlot = Math.sqrt(dx * dx + dy * dy + dz * dz);

      // Ships should be reasonably close to their formation positions (within 50 units)
      expect(distanceToFormationSlot).toBeLessThan(50);
    }

    // Verify no two ships occupy the same position (separation working)
    // But allow for close formation flying since they have specific formation positions
    for (let i = 0; i < gameState.ships.length; i++) {
      for (let j = i + 1; j < gameState.ships.length; j++) {
        const ship1 = gameState.ships[i];
        const ship2 = gameState.ships[j];
        const dx = ship1.pos.x - ship2.pos.x;
        const dy = ship1.pos.y - ship2.pos.y;
        const dz = ship1.pos.z - ship2.pos.z;
        const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);

        // Ships should maintain some minimum separation to avoid collision
        // In formation, ships can be closer but should not overlap completely
        expect(distance).toBeGreaterThan(1); // Just ensure no overlap/collision
      }
    }
  });

  test('should use configurable separation parameters', () => {
    // Test that separation uses the configured distance and weight
    const separationDistance = gameState.behaviorConfig!.globalSettings.separationDistance;
    const separationWeight = gameState.behaviorConfig!.globalSettings.separationWeight;

    expect(separationDistance).toBe(120); // From our default config
    expect(separationWeight).toBe(0.3); // From our default config

    // Test with modified config
    gameState.behaviorConfig!.globalSettings.separationDistance = 200;
    gameState.behaviorConfig!.globalSettings.separationWeight = 0.5;

    // Create two ships within the new separation distance
    const ship1 = spawnShip(gameState, 'red', 'fighter', { x: 100, y: 100, z: 100 });
    const ship2 = spawnShip(gameState, 'red', 'fighter', { x: 150, y: 100, z: 100 }); // 50 units away, within new separationDistance

    // Use reflection to access private method for testing
    const controller = aiController as any;
    const separationForce = controller.calculateSeparationForce(ship1);

    // Ship1 should experience separation force away from ship2
    expect(separationForce.x).toBeLessThan(0); // Force pointing away from ship2 (negative X direction)
    expect(Math.abs(separationForce.x)).toBeGreaterThan(0); // Some force should be applied
  });
});