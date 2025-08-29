import { describe, it, expect, beforeEach } from 'vitest';
import { createMockGameState } from './setupTests.js';
import { GameState, Ship, Vector3 } from '../../src/types/index.js';
import { AIController } from '../../src/core/aiController.js';
import { DEFAULT_BEHAVIOR_CONFIG } from '../../src/config/behaviorConfig.js';

describe('AI Evade Behavior', () => {
  let state: GameState;
  let aiController: AIController;

  beforeEach(() => {
    state = createMockGameState();
    state.behaviorConfig = { ...DEFAULT_BEHAVIOR_CONFIG };
    aiController = new AIController(state);
  });

  it('should accumulate recent damage and switch to evade when threshold exceeded', () => {
    // Create a ship that will take damage
    const ship: Ship = {
      id: 1,
      team: 'red',
      class: 'fighter',
      pos: { x: 100, y: 100, z: 100 },
      vel: { x: 0, y: 0, z: 0 },
      orientation: { pitch: 0, yaw: 0, roll: 0 },
      targetId: null,
      health: 100,
      maxHealth: 100,
      armor: 5,
      shield: 50,
      maxShield: 50,
      shieldRegen: 5,
      speed: 200,
      turnRate: 2,
      turrets: [],
      kills: 0,
      level: { level: 1, xp: 0, nextLevelXp: 100 },
      aiState: {
        currentIntent: 'idle',
        intentEndTime: 0,
        lastIntentReevaluation: 0,
        preferredRange: 150,
        recentDamage: 0,
        lastDamageTime: 0
      }
    };

    state.ships.push(ship);

    // Simulate damage accumulation by directly updating aiState
    // This simulates the damage tracking that would happen in updateBullets
    ship.aiState!.recentDamage = 20; // Above threshold of 15
    ship.aiState!.lastDamageTime = state.time;

    // Force reevaluation of intent
    ship.aiState!.lastIntentReevaluation = state.time - 2; // Force reevaluation

    // Add an enemy to make evade behavior meaningful
    const enemy: Ship = {
      id: 2,
      team: 'blue',
      class: 'fighter',
      pos: { x: 150, y: 100, z: 100 }, // Close to our ship
      vel: { x: 0, y: 0, z: 0 },
      orientation: { pitch: 0, yaw: 0, roll: 0 },
      targetId: 1,
      health: 100,
      maxHealth: 100,
      armor: 5,
      shield: 50,
      maxShield: 50,
      shieldRegen: 5,
      speed: 200,
      turnRate: 2,
      turrets: [],
      kills: 0,
      level: { level: 1, xp: 0, nextLevelXp: 100 }
    };

    state.ships.push(enemy);

    // Update AI - should switch to evade due to recent damage
    aiController.updateAllShips(0.1);

    // Ship should now have evade intent
    expect(ship.aiState?.currentIntent).toBe('evade');
  });

  it('should increase distance from attackers during evade', () => {
    // Create a ship with evade intent
    const ship: Ship = {
      id: 1,
      team: 'red',
      class: 'fighter',
      pos: { x: 100, y: 100, z: 100 },
      vel: { x: 0, y: 0, z: 0 },
      orientation: { pitch: 0, yaw: 0, roll: 0 },
      targetId: null,
      health: 100,
      maxHealth: 100,
      armor: 5,
      shield: 50,
      maxShield: 50,
      shieldRegen: 5,
      speed: 200,
      turnRate: 2,
      turrets: [],
      kills: 0,
      level: { level: 1, xp: 0, nextLevelXp: 100 },
      aiState: {
        currentIntent: 'evade',
        intentEndTime: state.time + 5,
        lastIntentReevaluation: state.time,
        preferredRange: 150,
        recentDamage: 25,
        lastDamageTime: state.time
      }
    };

    // Create nearby enemy
    const enemy: Ship = {
      id: 2,
      team: 'blue',
      class: 'fighter',
      pos: { x: 120, y: 105, z: 100 }, // Close to our ship
      vel: { x: 0, y: 0, z: 0 },
      orientation: { pitch: 0, yaw: 0, roll: 0 },
      targetId: 1,
      health: 100,
      maxHealth: 100,
      armor: 5,
      shield: 50,
      maxShield: 50,
      shieldRegen: 5,
      speed: 200,
      turnRate: 2,
      turrets: [],
      kills: 0,
      level: { level: 1, xp: 0, nextLevelXp: 100 }
    };

    state.ships.push(ship, enemy);

    // Record initial distance
    const initialDistance = Math.sqrt(
      Math.pow(ship.pos.x - enemy.pos.x, 2) +
      Math.pow(ship.pos.y - enemy.pos.y, 2) +
      Math.pow(ship.pos.z - enemy.pos.z, 2)
    );

    // Simulate several update cycles to let the ship move away
    for (let i = 0; i < 30; i++) {
      aiController.updateAllShips(0.1);
      // Simulate physics/position updates that would normally happen in gameState
      ship.pos.x += ship.vel.x * 0.1;
      ship.pos.y += ship.vel.y * 0.1;
      ship.pos.z += ship.vel.z * 0.1;
      state.time += 0.1;
    }

    // Calculate final distance
    const finalDistance = Math.sqrt(
      Math.pow(ship.pos.x - enemy.pos.x, 2) +
      Math.pow(ship.pos.y - enemy.pos.y, 2) +
      Math.pow(ship.pos.z - enemy.pos.z, 2)
    );

    // Ship should have increased distance from enemy by a reasonable margin
    expect(finalDistance).toBeGreaterThan(initialDistance + 20);
  });

  it('should decay recent damage over time', () => {
    const ship: Ship = {
      id: 1,
      team: 'red',
      class: 'fighter',
      pos: { x: 100, y: 100, z: 100 },
      vel: { x: 0, y: 0, z: 0 },
      orientation: { pitch: 0, yaw: 0, roll: 0 },
      targetId: null,
      health: 100,
      maxHealth: 100,
      armor: 5,
      shield: 50,
      maxShield: 50,
      shieldRegen: 5,
      speed: 200,
      turnRate: 2,
      turrets: [],
      kills: 0,
      level: { level: 1, xp: 0, nextLevelXp: 100 },
      aiState: {
        currentIntent: 'idle',
        intentEndTime: 0,
        lastIntentReevaluation: 0,
        preferredRange: 150,
        recentDamage: 20, // Start with damage above threshold
        lastDamageTime: state.time
      }
    };

    state.ships.push(ship);

    const initialDamage = ship.aiState!.recentDamage!;

    // Simulate time passing with damage decay
    for (let i = 0; i < 50; i++) {
      aiController.updateAllShips(0.1);
      state.time += 0.1;
    }

    // Recent damage should have decayed
    expect(ship.aiState!.recentDamage!).toBeLessThan(initialDamage);
    expect(ship.aiState!.recentDamage!).toBeGreaterThanOrEqual(0);
  });

  it('should use configurable evade parameters', () => {
    // Test that the config values are actually used
    const customConfig = { ...DEFAULT_BEHAVIOR_CONFIG };
    customConfig.globalSettings.damageEvadeThreshold = 10;
    customConfig.globalSettings.evadeSamplingCount = 4;
    customConfig.globalSettings.evadeDistance = 200;
    state.behaviorConfig = customConfig;

    const ship: Ship = {
      id: 1,
      team: 'red',
      class: 'fighter',
      pos: { x: 100, y: 100, z: 100 },
      vel: { x: 0, y: 0, z: 0 },
      orientation: { pitch: 0, yaw: 0, roll: 0 },
      targetId: null,
      health: 100,
      maxHealth: 100,
      armor: 5,
      shield: 50,
      maxShield: 50,
      shieldRegen: 5,
      speed: 200,
      turnRate: 2,
      turrets: [],
      kills: 0,
      level: { level: 1, xp: 0, nextLevelXp: 100 },
      aiState: {
        currentIntent: 'idle',
        intentEndTime: 0,
        lastIntentReevaluation: 0,
        preferredRange: 150,
        recentDamage: 12, // Above custom threshold of 10
        lastDamageTime: state.time
      }
    };

    state.ships.push(ship);

    // Force reevaluation
    ship.aiState!.lastIntentReevaluation = state.time - 2;

    // Add enemy
    const enemy: Ship = {
      id: 2,
      team: 'blue',
      class: 'fighter',
      pos: { x: 150, y: 100, z: 100 },
      vel: { x: 0, y: 0, z: 0 },
      orientation: { pitch: 0, yaw: 0, roll: 0 },
      targetId: 1,
      health: 100,
      maxHealth: 100,
      armor: 5,
      shield: 50,
      maxShield: 50,
      shieldRegen: 5,
      speed: 200,
      turnRate: 2,
      turrets: [],
      kills: 0,
      level: { level: 1, xp: 0, nextLevelXp: 100 }
    };

    state.ships.push(enemy);

    // Update AI with custom config
    aiController.updateAllShips(0.1);

    // Should switch to evade with lower threshold
    expect(ship.aiState?.currentIntent).toBe('evade');
  });
});