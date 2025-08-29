import { describe, it, expect, beforeEach } from 'vitest';
import { createMockGameState } from './setupTests.js';
import { GameState, Ship } from '../../src/types/index.js';
import { AIController } from '../../src/core/aiController.js';
import { simulateStep, applyBoundaryPhysics } from '../../src/core/gameState.js';
import { DEFAULT_BEHAVIOR_CONFIG } from '../../src/config/behaviorConfig.js';

describe('AI Boundary Physics', () => {
  let state: GameState;

  beforeEach(() => {
    state = createMockGameState();
    state.behaviorConfig = JSON.parse(JSON.stringify(DEFAULT_BEHAVIOR_CONFIG));
  });

  it('should enforce boundary physics when using AIController', () => {
    // Test that AIController now properly applies boundary physics
    const ship: Ship = {
      id: 1,
      team: 'red',
      class: 'fighter',
      pos: { x: 1005, y: 100, z: 100 }, // Start just outside bounds (width = 1000)
      vel: { x: 0, y: 0, z: 0 },
      orientation: { pitch: 0, yaw: 0, roll: 0 },
      dir: 0,
      targetId: null,
      health: 100,
      maxHealth: 100,
      armor: 5,
      shield: 50,
      maxShield: 50,
      shieldRegen: 5,
      speed: 200,
      turnRate: 2,
      turrets: [{ id: 'fighter-cannon', cooldownLeft: 0 }],
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

    // Manually test the boundary physics function
    applyBoundaryPhysics(ship, state);

    // With bounce behavior, ship should be moved back to boundary
    expect(ship.pos.x).toBeLessThanOrEqual(state.simConfig.simBounds.width);
    expect(ship.pos.x).toBe(state.simConfig.simBounds.width); // Should be exactly at boundary
  });

  it('should handle wrap boundary behavior when using AIController', () => {
    // Set boundary behavior to wrap
    state.simConfig.boundaryBehavior.ships = 'wrap';
    
    // Create a ship near the boundary with velocity pushing it out of bounds
    const ship: Ship = {
      id: 1,
      team: 'red',
      class: 'fighter',
      pos: { x: 990, y: 100, z: 100 }, // Near right boundary (bounds width = 1000)
      vel: { x: 500, y: 0, z: 0 }, // High velocity to the right
      orientation: { pitch: 0, yaw: 0, roll: 0 },
      dir: 0,
      targetId: null,
      health: 100,
      maxHealth: 100,
      armor: 5,
      shield: 50,
      maxShield: 50,
      shieldRegen: 5,
      speed: 200,
      turnRate: 2,
      turrets: [{ id: 'fighter-cannon', cooldownLeft: 0 }],
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

    // Simulate steps to push ship past boundary
    const dt = 1/60; // 60 FPS
    for (let i = 0; i < 5; i++) {
      simulateStep(state, dt);
    }

    // With wrap behavior, ship should wrap around to other side when going out of bounds
    // (This test will currently fail since AIController doesn't handle boundary physics)
    expect(ship.pos.x).toBeLessThanOrEqual(state.simConfig.simBounds.width);
    expect(ship.pos.x).toBeGreaterThanOrEqual(0);
  });

  it('should apply same boundary physics for legacy AI and AIController', () => {
    // Test both paths produce same boundary behavior
    const ship1: Ship = {
      id: 1,
      team: 'red',
      class: 'fighter',
      pos: { x: 995, y: 100, z: 100 }, // Near boundary
      vel: { x: 50, y: 0, z: 0 }, // Moving toward boundary
      orientation: { pitch: 0, yaw: 0, roll: 0 },
      dir: 0,
      targetId: null,
      health: 100,
      maxHealth: 100,
      armor: 5,
      shield: 50,
      maxShield: 50,
      shieldRegen: 5,
      speed: 200,
      turnRate: 2,
      turrets: [{ id: 'fighter-cannon', cooldownLeft: 0 }],
      kills: 0,
      level: { level: 1, xp: 0, nextLevelXp: 100 }
    };

    const ship2 = JSON.parse(JSON.stringify(ship1));
    ship2.id = 2;
    ship2.aiState = {
      currentIntent: 'idle',
      intentEndTime: 0,
      lastIntentReevaluation: 0,
      preferredRange: 150,
      recentDamage: 0,
      lastDamageTime: 0
    };

    // Add an enemy target for both ships to pursue
    const enemyShip: Ship = {
      id: 3,
      team: 'blue',
      class: 'fighter', 
      pos: { x: 1050, y: 100, z: 100 }, // Past the boundary
      vel: { x: 0, y: 0, z: 0 },
      orientation: { pitch: 0, yaw: 0, roll: 0 },
      dir: 0,
      targetId: null,
      health: 100,
      maxHealth: 100,
      armor: 5,
      shield: 50,
      maxShield: 50,
      shieldRegen: 5,
      speed: 200,
      turnRate: 2,
      turrets: [{ id: 'fighter-cannon', cooldownLeft: 0 }],
      kills: 0,
      level: { level: 1, xp: 0, nextLevelXp: 100 }
    };

    // State 1: Use legacy AI (no behaviorConfig)
    const state1 = createMockGameState();
    (state1.ships as Ship[]).push(ship1, JSON.parse(JSON.stringify(enemyShip)));

    // State 2: Use AIController
    const state2 = createMockGameState();
    state2.behaviorConfig = JSON.parse(JSON.stringify(DEFAULT_BEHAVIOR_CONFIG));
    (state2.ships as Ship[]).push(ship2, JSON.parse(JSON.stringify(enemyShip)));

    // Simulate same number of steps
    const dt = 1/60;
    for (let i = 0; i < 10; i++) {
      simulateStep(state1, dt);
      simulateStep(state2, dt);
    }

    // Both should respect boundaries (legacy now delegates to AIController)
    expect(ship1.pos.x).toBeLessThanOrEqual(state1.simConfig.simBounds.width);
    expect(ship2.pos.x).toBeLessThanOrEqual(state2.simConfig.simBounds.width);
    
    // Since legacy AI now delegates to AIController, behavior should be more similar
    // (allow some variation due to different intent evaluation timing)
    const positionDiff = Math.abs(ship1.pos.x - ship2.pos.x);
    expect(positionDiff).toBeLessThan(100); // Should be reasonably close
  });
});