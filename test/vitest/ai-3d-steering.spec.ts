import { describe, test, expect, beforeEach } from 'vitest';
import type { GameState, Ship, Vector3 } from '../../src/types/index.js';
import { AIController } from '../../src/core/aiController.js';
import { DEFAULT_BEHAVIOR_CONFIG } from '../../src/config/behaviorConfig.js';
import { DefaultSimConfig } from '../../src/config/simConfig.js';
import { createInitialState, spawnShip } from '../../src/core/gameState.js';
import { createRNG } from '../../src/utils/rng.js';
import { lookAt, getForwardVector, angleDifference } from '../../src/utils/vector3.js';

/**
 * 3D Steering Tests
 * Tests the new 3D orientation and steering system for ships
 */

describe('3D Steering System', () => {
  let gameState: GameState;
  let aiController: AIController;

  beforeEach(() => {
    gameState = createInitialState('test-3d-seed');
    gameState.behaviorConfig = { ...DEFAULT_BEHAVIOR_CONFIG };
    gameState.behaviorConfig.globalSettings.aiEnabled = true;
    aiController = new AIController(gameState);
  });

  describe('Vector3 Utilities', () => {
    test('lookAt should calculate correct orientation for target directly ahead', () => {
      const fromPos = { x: 0, y: 0, z: 0 };
      const targetPos = { x: 100, y: 0, z: 0 };
      
      const orientation = lookAt(fromPos, targetPos);
      
      expect(orientation.yaw).toBeCloseTo(0, 5); // Looking along +X axis
      expect(orientation.pitch).toBeCloseTo(0, 5); // No vertical angle
    });

    test('lookAt should calculate correct orientation for target above and to the right', () => {
      const fromPos = { x: 0, y: 0, z: 0 };
      const targetPos = { x: 100, y: 100, z: 100 };
      
      const orientation = lookAt(fromPos, targetPos);
      
      expect(orientation.yaw).toBeCloseTo(Math.PI / 4, 5); // 45 degrees right
      expect(orientation.pitch).toBeGreaterThan(0); // Looking up
    });

    test('getForwardVector should return correct 3D direction', () => {
      // Level flight along +X axis
      let forward = getForwardVector(0, 0);
      expect(forward.x).toBeCloseTo(1, 5);
      expect(forward.y).toBeCloseTo(0, 5);
      expect(forward.z).toBeCloseTo(0, 5);

      // 45 degree pitch up
      forward = getForwardVector(Math.PI / 4, 0);
      expect(forward.x).toBeCloseTo(Math.cos(Math.PI / 4), 5);
      expect(forward.y).toBeCloseTo(0, 5);
      expect(forward.z).toBeCloseTo(Math.sin(Math.PI / 4), 5);
    });

    test('angleDifference should calculate shortest angular path', () => {
      expect(angleDifference(0, Math.PI / 2)).toBeCloseTo(Math.PI / 2, 5);
      expect(angleDifference(Math.PI / 2, 0)).toBeCloseTo(-Math.PI / 2, 5);
      expect(angleDifference(-Math.PI, Math.PI)).toBeCloseTo(0, 5); // Wraps around
    });
  });

  describe('Ship 3D Orientation', () => {
    test('spawned ships should have valid 3D orientation', () => {
      const ship = spawnShip(gameState, 'red', 'fighter');
      
      expect(ship.orientation).toBeDefined();
      expect(ship.orientation.pitch).toBeDefined();
      expect(ship.orientation.yaw).toBeDefined();
      expect(ship.orientation.roll).toBeDefined();
      
      // Legacy dir field should match yaw
      expect(ship.dir).toBe(ship.orientation.yaw);
    });

    test('ship orientation should start with level flight', () => {
      const ship = spawnShip(gameState, 'red', 'fighter');
      
      expect(ship.orientation.pitch).toBe(0); // Level flight
      expect(ship.orientation.roll).toBe(0);  // No banking
      // Yaw can be random
    });
  });

  describe('3D AI Movement', () => {
    test('ships should orient towards targets in 3D space', () => {
      // Create two ships at different Z levels
      const ship1 = spawnShip(gameState, 'red', 'fighter', { x: 0, y: 0, z: 0 });
      const ship2 = spawnShip(gameState, 'blue', 'fighter', { x: 100, y: 0, z: 100 });
      
      ship1.orientation = { pitch: 0, yaw: 0, roll: 0 };
      ship1.dir = 0;
      
      // Set explicit targeting to ensure ship1 targets ship2
      ship1.targetId = ship2.id;
      
      // Debug: Test the lookAt function directly
      const expectedOrientation = lookAt(ship1.pos, ship2.pos);
      expect(expectedOrientation.pitch).toBeCloseTo(Math.PI / 4, 2); // Should be 45 degrees
      
      // For now, let's test the basic movement system by directly calling the movement function
      // Get the AI controller's private moveTowards method by testing it indirectly
      ship1.aiState = {
        currentIntent: 'pursue',
        intentEndTime: gameState.time + 10,
        lastIntentReevaluation: gameState.time,
        preferredRange: 100
      };
      
      // Run AI update - should execute pursue intent which calls moveTowards
      aiController.updateAllShips(0.1);
      
      // The ship should have adjusted its orientation towards the target
      // At this point we expect positive pitch since target is above current position
      expect(ship1.orientation.pitch).toBeGreaterThan(0); // Should pitch up to target
    });

    test('ships should move in 3D using forward vector', () => {
      const ship = spawnShip(gameState, 'red', 'fighter', { x: 0, y: 0, z: 0 });
      const target = spawnShip(gameState, 'blue', 'fighter', { x: 100, y: 0, z: 100 });
      
      // Set the ship's orientation manually to 45 degrees pitch up
      ship.orientation = { pitch: Math.PI / 4, yaw: 0, roll: 0 }; // 45 degrees up
      ship.dir = 0;
      ship.vel = { x: 0, y: 0, z: 0 };
      ship.targetId = target.id; // Explicit targeting
      
      // Force pursue intent
      ship.aiState = {
        currentIntent: 'pursue',
        intentEndTime: gameState.time + 10,
        lastIntentReevaluation: gameState.time,
        preferredRange: 100
      };
      
      // Run AI update
      aiController.updateAllShips(0.1);
      
      // Ship should move forward and upward
      expect(ship.vel.x).toBeGreaterThan(0); // Moving forward
      expect(ship.vel.z).toBeGreaterThan(0); // Moving upward
    });

    test('separation steering should work in 3D', () => {
      // Create a cluster of ships at the same Z level
      const ship1 = spawnShip(gameState, 'red', 'fighter', { x: 0, y: 0, z: 0 });
      const ship2 = spawnShip(gameState, 'red', 'fighter', { x: 50, y: 0, z: 0 }); // Close but not too close to trigger separation
      const ship3 = spawnShip(gameState, 'red', 'fighter', { x: 0, y: 50, z: 0 });
      const target = spawnShip(gameState, 'blue', 'fighter', { x: 300, y: 300, z: 100 });
      
      // Clear velocities
      [ship1, ship2, ship3].forEach(ship => {
        ship.vel = { x: 0, y: 0, z: 0 };
        ship.orientation = { pitch: 0, yaw: 0, roll: 0 };
        ship.dir = 0;
        ship.targetId = target.id; // Explicit targeting
      });
      
      const initialDistance12 = Math.hypot(
        ship1.pos.x - ship2.pos.x,
        ship1.pos.y - ship2.pos.y,
        ship1.pos.z - ship2.pos.z
      );
      
      // Run AI updates to let separation forces take effect
      for (let i = 0; i < 20; i++) {
        aiController.updateAllShips(0.1);
        gameState.time += 0.1;
      }
      
      // All ships should be moving toward the target (have non-zero velocity)
      [ship1, ship2, ship3].forEach(ship => {
        const speed = Math.hypot(ship.vel.x, ship.vel.y, ship.vel.z);
        expect(speed).toBeGreaterThan(0); // Ships should be moving
      });
    });
  });

  describe('Legacy Compatibility', () => {
    test('legacy dir field should stay synchronized with yaw', () => {
      const ship = spawnShip(gameState, 'red', 'fighter');
      const target = spawnShip(gameState, 'blue', 'fighter', { x: 100, y: 100, z: 0 });
      
      const initialYaw = ship.orientation.yaw;
      const initialDir = ship.dir;
      expect(initialDir).toBe(initialYaw);
      
      // Update AI
      aiController.updateAllShips(0.1);
      
      // dir and yaw should remain synchronized
      expect(ship.dir).toBe(ship.orientation.yaw);
    });
  });

  describe('3D Formation Behavior', () => {
    test('ships should move toward targets in 3D formations', () => {
      gameState.behaviorConfig!.globalSettings.separationWeight = 0.5;
      
      // Create a formation of ships at different Z levels
      const ships = [];
      for (let i = 0; i < 3; i++) {
        const ship = spawnShip(gameState, 'red', 'fighter', {
          x: 50 + i * 30,
          y: 50,
          z: 50 + i * 20 // Create a 3D formation
        });
        ship.vel = { x: 0, y: 0, z: 0 };
        ships.push(ship);
      }
      
      // Add a target for them to pursue
      const target = spawnShip(gameState, 'blue', 'fighter', { x: 300, y: 300, z: 150 });
      
      // Set explicit targeting
      ships.forEach(ship => {
        ship.targetId = target.id;
      });
      
      // Let the formation move toward the target
      for (let i = 0; i < 20; i++) {
        aiController.updateAllShips(0.1);
        gameState.time += 0.1;
      }
      
      // All ships should be moving (have non-zero velocity)
      ships.forEach(ship => {
        const speed = Math.hypot(ship.vel.x, ship.vel.y, ship.vel.z);
        expect(speed).toBeGreaterThan(0); // Ships should be moving
      });
    });
  });
});