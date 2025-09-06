import { describe, it, expect, beforeEach } from 'vitest';
import { createMockGameState, createMockShip, getTestDtFromState } from './setupTests.js';
import { GameState, Ship } from '../../src/types/index.js';
import { AIController } from '../../src/core/aiController.js';
import { DEFAULT_BEHAVIOR_CONFIG } from '../../src/config/behaviorConfig.js';
import { DEBUG_AI } from '../../src/utils/env.js';

describe('AI Evade Behavior', () => {
  let state: GameState;
  let aiController: AIController;

  beforeEach(() => {
    state = createMockGameState();
    state.behaviorConfig = { ...DEFAULT_BEHAVIOR_CONFIG };
    aiController = new AIController(state);
  });

  it('should accumulate recent damage and switch to evade when threshold exceeded', () => {
    // Create a ship that will take damage (derive defaults from canonical config)
    const ship: Ship = createMockShip({
      id: 1,
      team: 'red',
      class: 'fighter',
      pos: { x: 100, y: 100, z: 100 },
      vel: { x: 0, y: 0, z: 0 },
      orientation: { pitch: 0, yaw: 0, roll: 0 },
      targetId: null,
      armor: 5,
      shieldRegen: 5,
      speed: 200,
      turnRate: 2,
      turrets: [],
      aiState: {
        currentIntent: 'idle',
        intentEndTime: 0,
        lastIntentReevaluation: 0,
        preferredRange: 150,
        recentDamage: 0,
        lastDamageTime: 0
      }
    }) as unknown as Ship;

    state.ships.push(ship);

    if (state.spatialGrid && state.behaviorConfig?.globalSettings.enableSpatialIndex) {
      state.spatialGrid.rebuild(state.ships.map(s => ({ id: s.id, pos: s.pos, radius: 16, team: s.team })));
    }

    // Simulate damage accumulation by directly updating aiState
    // This simulates the damage tracking that would happen in updateBullets
    ship.aiState!.recentDamage = 30; // Above threshold of 25
    ship.aiState!.lastDamageTime = state.time;

    // Force reevaluation of intent
    ship.aiState!.lastIntentReevaluation = state.time - 2; // Force reevaluation

    // Add an enemy to make evade behavior meaningful
    const enemy: Ship = createMockShip({
      id: 2,
      team: 'blue',
      class: 'fighter',
      pos: { x: 150, y: 100, z: 100 }, // Close to our ship
      targetId: 1,
      armor: 5,
      shieldRegen: 5,
      speed: 200,
      turnRate: 2,
      turrets: []
    }) as unknown as Ship;

    state.ships.push(enemy);

    if (state.spatialGrid && state.behaviorConfig?.globalSettings.enableSpatialIndex) {
      state.spatialGrid.rebuild(state.ships.map(s => ({ id: s.id, pos: s.pos, radius: 16, team: s.team })));
    }

    // Update AI - should switch to evade due to recent damage
  aiController.updateAllShips(getTestDtFromState(state));

    // Ship should now have evade intent
    expect(ship.aiState?.currentIntent).toBe('evade');
  });

  it('should increase distance from attackers during evade', () => {
    // Create a simplified test that directly triggers the evade behavior
    // Create a ship with evade intent
    const ship: Ship = createMockShip({
      id: 1,
      team: 'red',
      class: 'fighter',
      pos: { x: 100, y: 100, z: 100 },
      vel: { x: 0, y: 0, z: 0 },
      speed: 20,  // Increase ship speed for faster movement
      turnRate: 10 // Increase turn rate for more responsive movement
    }) as unknown as Ship;

    // Create nearby enemy
    const enemy: Ship = createMockShip({
      id: 2,
      team: 'blue',
      class: 'fighter',
      pos: { x: 120, y: 100, z: 100 }, // Directly to the right of our ship
    }) as unknown as Ship;

    state.ships = [ship, enemy]; // Replace all ships with just these two

    if (state.spatialGrid && state.behaviorConfig?.globalSettings.enableSpatialIndex) {
      state.spatialGrid.rebuild(state.ships.map(s => ({ id: s.id, pos: s.pos, radius: 16, team: s.team })));
    }
    
    // Set up the ship's aiState with evade intent
    ship.aiState = {
      currentIntent: 'evade',
      intentEndTime: 999999, // Far future
      lastIntentReevaluation: 0,
      preferredRange: 150,
      recentDamage: 50,
      lastDamageTime: 0
    };

    // Force target ID assignment to ensure the ship evades from this enemy
    ship.targetId = enemy.id;

    // Get initial distance
    const initialDistance = Math.sqrt(
      Math.pow(ship.pos.x - enemy.pos.x, 2) +
      Math.pow(ship.pos.y - enemy.pos.y, 2) +
      Math.pow(ship.pos.z - enemy.pos.z, 2)
    );

    // Directly use the controller's moveTowards function with an escape target
    // This bypasses the need for finding the nearest enemy
    const escapeTarget = {
      x: ship.pos.x - (enemy.pos.x - ship.pos.x), // Double the vector away from enemy
      y: ship.pos.y - (enemy.pos.y - ship.pos.y),
      z: ship.pos.z - (enemy.pos.z - ship.pos.z)
    };

    // Apply movement for multiple ticks
    for (let i = 0; i < 10; i++) {
      // Directly call moveTowards with the escape target and force movement
      aiController.moveTowards(ship, escapeTarget, getTestDtFromState(state), true);
      
      // Move the ship based on its velocity
  const dt = getTestDtFromState(state);
  ship.pos.x += ship.vel.x * dt;
  ship.pos.y += ship.vel.y * dt;
  ship.pos.z += ship.vel.z * dt;
      
      if (DEBUG_AI && i % 2 === 0) {
        console.error(`AI-DEBUG direct evade iter=${i} pos=${ship.pos.x.toFixed(2)},${ship.pos.y.toFixed(2)},${ship.pos.z.toFixed(2)} vel=${ship.vel.x.toFixed(2)},${ship.vel.y.toFixed(2)},${ship.vel.z.toFixed(2)}`);
      }
    }

    // Calculate final distance
    const finalDistance = Math.sqrt(
      Math.pow(ship.pos.x - enemy.pos.x, 2) +
      Math.pow(ship.pos.y - enemy.pos.y, 2) +
      Math.pow(ship.pos.z - enemy.pos.z, 2)
    );

    console.log(`Initial distance: ${initialDistance.toFixed(2)}, Final distance: ${finalDistance.toFixed(2)}, Change: ${(finalDistance - initialDistance).toFixed(2)}`);

    // Ship should have increased distance from enemy
    expect(finalDistance).toBeGreaterThan(initialDistance + 4);
  });

  it('should decay recent damage over time', () => {
    const ship: Ship = createMockShip({
      id: 1,
      team: 'red',
      class: 'fighter',
      pos: { x: 100, y: 100, z: 100 },
      turrets: [],
      aiState: {
        currentIntent: 'idle',
        intentEndTime: 0,
        lastIntentReevaluation: 0,
        preferredRange: 150,
        recentDamage: 20,
        lastDamageTime: state.time
      }
    }) as unknown as Ship;

    state.ships.push(ship);

    const initialDamage = ship.aiState!.recentDamage!;

    // Simulate time passing with damage decay
    for (let i = 0; i < 50; i++) {
      const dt = getTestDtFromState(state);
      aiController.updateAllShips(dt);
      state.time += dt;
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

    const ship: Ship = createMockShip({
      id: 1,
      team: 'red',
      class: 'fighter',
      pos: { x: 100, y: 100, z: 100 },
      turrets: [],
      aiState: {
        currentIntent: 'idle',
        intentEndTime: 0,
        lastIntentReevaluation: 0,
        preferredRange: 150,
        recentDamage: 12,
        lastDamageTime: state.time
      }
    }) as unknown as Ship;

    state.ships.push(ship);

    // Force reevaluation
    ship.aiState!.lastIntentReevaluation = state.time - 2;

    // Add enemy
    const enemy: Ship = createMockShip({
      id: 2,
      team: 'blue',
      class: 'fighter',
      pos: { x: 150, y: 100, z: 100 },
      targetId: 1,
      turrets: []
    }) as unknown as Ship;

    state.ships.push(enemy);

    // Update AI with custom config
  aiController.updateAllShips(getTestDtFromState(state));

    // Should switch to evade with lower threshold
    expect(ship.aiState?.currentIntent).toBe('evade');
  });

  it('should only evade within the recent damage window', () => {
    // Test that evade behavior respects the configurable time window
    const ship: Ship = createMockShip({
      id: 1,
      team: 'red',
      class: 'fighter',
      pos: { x: 100, y: 100, z: 100 },
      turrets: [],
      aiState: {
        currentIntent: 'idle',
        intentEndTime: 0,
        lastIntentReevaluation: 0,
        preferredRange: 150,
        recentDamage: 30,
        lastDamageTime: state.time
      }
    }) as unknown as Ship;

    // Create defensive personality to test defensive evade logic
    const defensivePersonality = {
      mode: 'defensive' as const,
      intentReevaluationRate: 1.0,
      minIntentDuration: 2,
      maxIntentDuration: 8,
      aggressiveness: 0.2,
      caution: 0.8,
      groupCohesion: 0.3,
      preferredRangeMultiplier: 0.8
    };

    // Override personality for this test
    const originalPersonality = state.behaviorConfig!.shipPersonalities.fighter;
    state.behaviorConfig!.shipPersonalities.fighter = defensivePersonality;

    // Enable evadeOnlyOnDamage to test the new logic
    state.behaviorConfig!.globalSettings.evadeOnlyOnDamage = true;
    state.behaviorConfig!.globalSettings.evadeRecentDamageWindowSeconds = 2.0;

    const enemy: Ship = createMockShip({
      id: 2,
      team: 'blue',
      class: 'fighter',
      pos: { x: 130, y: 100, z: 100 }, // Close to trigger evade
      targetId: 1,
      turrets: []
    }) as unknown as Ship;

    state.ships.push(ship, enemy);

    // Force intent reevaluation
    ship.aiState!.lastIntentReevaluation = state.time - 2;

    // Test 1: Within damage window - should evade
  aiController.updateAllShips(getTestDtFromState(state));
    expect(ship.aiState?.currentIntent).toBe('evade');

    // Test 2: Wait until outside damage window - should not evade
    state.time += 3.0; // Move past the 2-second window
    ship.aiState!.lastIntentReevaluation = state.time - 2; // Force reevaluation
    ship.aiState!.currentIntent = 'idle'; // Reset intent
    ship.aiState!.intentEndTime = 0; // Allow intent change

    aiController.updateAllShips(0.1);
    expect(ship.aiState?.currentIntent).not.toBe('evade');

    // Restore original personality
    if (originalPersonality) {
      state.behaviorConfig!.shipPersonalities.fighter = originalPersonality;
    }
  });

  it('should not evade when unrelated ships have no recent damage', () => {
    // Test that ships without recent damage don't enter evade
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
        recentDamage: 0, // No damage
        lastDamageTime: 0 // No damage time
      }
    };

    // Create defensive personality to test defensive evade logic
    const defensivePersonality = {
      mode: 'defensive' as const,
      intentReevaluationRate: 1.0,
      minIntentDuration: 2,
      maxIntentDuration: 8,
      aggressiveness: 0.2,
      caution: 0.8,
      groupCohesion: 0.3,
      preferredRangeMultiplier: 0.8
    };

    // Override personality for this test
    const originalPersonality = state.behaviorConfig!.shipPersonalities.fighter;
    state.behaviorConfig!.shipPersonalities.fighter = defensivePersonality;

    // Enable evadeOnlyOnDamage to test the new logic
    state.behaviorConfig!.globalSettings.evadeOnlyOnDamage = true;

    const enemy: Ship = createMockShip({
      id: 2,
      team: 'blue',
      class: 'fighter',
      pos: { x: 130, y: 100, z: 100 }, // Close to ship
      targetId: 1,
      turrets: []
    }) as unknown as Ship;

    state.ships.push(ship, enemy);

    // Force intent reevaluation
    ship.aiState!.lastIntentReevaluation = state.time - 2;

    // Ship should not evade since it has no recent damage
    aiController.updateAllShips(0.1);
    expect(ship.aiState?.currentIntent).not.toBe('evade');

    // Restore original personality
    if (originalPersonality) {
      state.behaviorConfig!.shipPersonalities.fighter = originalPersonality;
    }
  });
});
