import { describe, it, expect, beforeEach } from 'vitest';
import { createMockGameState } from './setupTests.js';
import { GameState, Ship } from '../../src/types/index.js';
import { AIController } from '../../src/core/aiController.js';
import { DEFAULT_BEHAVIOR_CONFIG, AIPersonality } from '../../src/config/behaviorConfig.js';

describe('AI Intent Selection - Engagement vs Evasion', () => {
  let state: GameState;
  let aiController: AIController;

  beforeEach(() => {
    state = createMockGameState();
    // Create a deep copy of the config to avoid shared state between tests
    state.behaviorConfig = JSON.parse(JSON.stringify(DEFAULT_BEHAVIOR_CONFIG));
    aiController = new AIController(state);
  });

  it('should prefer engagement over evasion for aggressive fighters with evadeOnlyOnDamage enabled', () => {
    // Enable the new evade-only-on-damage behavior
    state.behaviorConfig!.globalSettings.evadeOnlyOnDamage = true;

    // Create an aggressive fighter (default personality has aggressiveness: 0.9, caution: 0.1)
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
        recentDamage: 0, // No recent damage
        lastDamageTime: 0
      }
    };

    // Place an enemy very close (within defensive evade range)
    const enemy: Ship = {
      id: 2,
      team: 'blue',
      class: 'fighter',
      pos: { x: 120, y: 100, z: 100 }, // 20 units away, well within preferredRange * 0.5 = 75
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
      level: { level: 1, xp: 0, nextLevelXp: 100 }
    };

    state.ships.push(ship, enemy);

    // Use deterministic RNG for consistent test results
    let rngCallCount = 0;
    const originalRng = state.rng.next;
    state.rng.next = () => {
      rngCallCount++;
      // Return values that favor aggressive intent selection
      return 0.1; // Well below aggressiveness threshold of 0.9
    };

    // Force intent reevaluation
    ship.aiState!.lastIntentReevaluation = state.time - 10;

    // Update AI
    aiController.updateAllShips(0.1);

    // With evadeOnlyOnDamage=true and no recent damage, ship should NOT evade
    // Instead it should choose an aggressive or group intent
    expect(ship.aiState?.currentIntent).not.toBe('evade');
    expect(['pursue', 'strafe', 'group', 'patrol']).toContain(ship.aiState?.currentIntent);

    // Restore original RNG
    state.rng.next = originalRng;
  });

  it('should still evade when recently damaged even with evadeOnlyOnDamage enabled', () => {
    // Enable the new evade-only-on-damage behavior
    state.behaviorConfig!.globalSettings.evadeOnlyOnDamage = true;

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
        recentDamage: 30, // Above damage threshold
        lastDamageTime: state.time
      }
    };

    const enemy: Ship = {
      id: 2,
      team: 'blue',
      class: 'fighter',
      pos: { x: 120, y: 100, z: 100 }, // Close enemy
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
      level: { level: 1, xp: 0, nextLevelXp: 100 }
    };

    state.ships.push(ship, enemy);

    // Force intent reevaluation
    ship.aiState!.lastIntentReevaluation = state.time - 10;

    // Update AI
    aiController.updateAllShips(0.1);

    // With recent damage, ship should evade
    expect(ship.aiState?.currentIntent).toBe('evade');
  });

  it('should maintain backwards compatibility with evadeOnlyOnDamage disabled', () => {
    // Use default config (evadeOnlyOnDamage: false)
    expect(state.behaviorConfig!.globalSettings.evadeOnlyOnDamage).toBe(false);

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
        recentDamage: 0, // No recent damage
        lastDamageTime: 0
      }
    };

    const enemy: Ship = {
      id: 2,
      team: 'blue',
      class: 'fighter',
      pos: { x: 120, y: 100, z: 100 }, // Close enemy
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
      level: { level: 1, xp: 0, nextLevelXp: 100 }
    };

    state.ships.push(ship, enemy);

    // Set ship to defensive mode to trigger defensive intent selection
    const defensivePersonality: AIPersonality = {
      mode: 'defensive',
      intentReevaluationRate: 0.5,
      minIntentDuration: 2,
      maxIntentDuration: 8,
      aggressiveness: 0.2,
      caution: 0.8,
      groupCohesion: 0.3,
      preferredRangeMultiplier: 0.8
    };

    // Override personality temporarily for this test
    const originalGetPersonality = state.behaviorConfig!.shipPersonalities.fighter;
    state.behaviorConfig!.shipPersonalities.fighter = defensivePersonality;

    // Force intent reevaluation
    ship.aiState!.lastIntentReevaluation = state.time - 10;

    // Update AI
    aiController.updateAllShips(0.1);

    // With backwards compatibility, ship should evade based on proximity
    expect(ship.aiState?.currentIntent).toBe('evade');

    // Restore original personality
    if (originalGetPersonality) {
      state.behaviorConfig!.shipPersonalities.fighter = originalGetPersonality;
    }
  });

  it('should choose aggressive intents for fighters in mixed mode when evadeOnlyOnDamage is enabled', () => {
    // Enable the new behavior
    state.behaviorConfig!.globalSettings.evadeOnlyOnDamage = true;

    const ship: Ship = {
      id: 1,
      team: 'red',
      class: 'fighter', // Fighter has mode: 'aggressive' by default
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

    // Place enemy at medium range to trigger pursue
    const enemy: Ship = {
      id: 2,
      team: 'blue',
      class: 'fighter',
      pos: { x: 250, y: 100, z: 100 }, // 150 units away, within preferredRange * 1.2 = 180
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
      level: { level: 1, xp: 0, nextLevelXp: 100 }
    };

    state.ships.push(ship, enemy);

    // Force intent reevaluation
    ship.aiState!.lastIntentReevaluation = state.time - 10;

    // Update AI
    aiController.updateAllShips(0.1);

    // Fighter in aggressive mode should pursue
    expect(ship.aiState?.currentIntent).toBe('pursue');
  });
});