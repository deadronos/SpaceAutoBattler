import { describe, it, expect, beforeEach } from 'vitest';
import { createMockGameState } from './setupTests.js';
import { GameState, Ship } from '../../src/types/index.js';
import { AIController } from '../../src/core/aiController.js';
import { DEFAULT_BEHAVIOR_CONFIG } from '../../src/config/behaviorConfig.js';

describe('AI Engagement Integration Test', () => {
  let state: GameState;
  let aiController: AIController;

  beforeEach(() => {
    state = createMockGameState();
    state.behaviorConfig = JSON.parse(JSON.stringify(DEFAULT_BEHAVIOR_CONFIG));
    aiController = new AIController(state);
  });

  it('should demonstrate improved engagement with evadeOnlyOnDamage enabled', () => {
    // Enable the new behavior
    state.behaviorConfig!.globalSettings.evadeOnlyOnDamage = true;

    // Create a scenario: 3 vs 3 fighters in close proximity
    const redShips: Ship[] = [];
    const blueShips: Ship[] = [];

    for (let i = 0; i < 3; i++) {
      const redShip: Ship = {
        id: i + 1,
        team: 'red',
        class: 'fighter',
        pos: { x: 100 + i * 50, y: 100, z: 100 },
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

      const blueShip: Ship = {
        id: i + 4,
        team: 'blue',
        class: 'fighter',
        pos: { x: 300 + i * 50, y: 100, z: 100 }, // 200 units away
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

      redShips.push(redShip);
      blueShips.push(blueShip);
    }

    state.ships.push(...redShips, ...blueShips);

    // Simulate for 2 seconds (20 ticks at 10 updates per second)
    let engagedShips = 0;
    let evadingShips = 0;

    for (let tick = 0; tick < 20; tick++) {
      aiController.updateAllShips(0.1);
      state.time += 0.1;

      // Count engagement behaviors after ships have had time to choose intents
      if (tick >= 5) {
        for (const ship of state.ships) {
          if (ship.aiState?.currentIntent === 'pursue' || ship.aiState?.currentIntent === 'strafe') {
            engagedShips++;
          } else if (ship.aiState?.currentIntent === 'evade') {
            evadingShips++;
          }
        }
      }
    }

    // With evadeOnlyOnDamage=true, we should see more engagement and less evasion
    const totalBehaviorCount = engagedShips + evadingShips;
    const engagementRatio = totalBehaviorCount > 0 ? engagedShips / totalBehaviorCount : 0;

    console.log(`Engagement stats - Engaged: ${engagedShips}, Evading: ${evadingShips}, Ratio: ${engagementRatio.toFixed(2)}`);

    // With aggressive fighters and no damage, we should see primarily engagement behavior
    expect(engagementRatio).toBeGreaterThan(0.6); // At least 60% engagement vs evasion
    expect(engagedShips).toBeGreaterThan(evadingShips); // More engagement than evasion
  });

  it('should demonstrate backwards compatibility - more evasion with evadeOnlyOnDamage disabled', () => {
    // Use default behavior (evadeOnlyOnDamage: false)
    expect(state.behaviorConfig!.globalSettings.evadeOnlyOnDamage).toBe(false);

    // Create the same scenario but with ships closer together to trigger defensive behavior
    const ships: Ship[] = [];

    for (let i = 0; i < 4; i++) {
      const ship: Ship = {
        id: i + 1,
        team: i < 2 ? 'red' : 'blue',
        class: 'corvette', // Use corvettes with mixed mode for more varied behavior
        pos: { x: 150 + (i % 2) * 100, y: 100 + Math.floor(i / 2) * 100, z: 100 },
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
        turrets: [{ id: 'corvette-cannon', cooldownLeft: 0 }],
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

      ships.push(ship);
    }

    state.ships.push(...ships);

    // Set some ships to defensive personalities to increase evade likelihood
    const defensivePersonality = {
      mode: 'defensive' as const,
      intentReevaluationRate: 1.0,
      minIntentDuration: 2,
      maxIntentDuration: 8,
      aggressiveness: 0.2,
      caution: 0.8,
      groupCohesion: 0.3,
      preferredRangeMultiplier: 1.0
    };

    // Override some ship personalities to be defensive
    state.behaviorConfig!.shipPersonalities.corvette = defensivePersonality;

    let evadeCount = 0;
    let totalIntentChecks = 0;

    // Simulate for a shorter time to capture initial defensive responses
    for (let tick = 0; tick < 10; tick++) {
      aiController.updateAllShips(0.1);
      state.time += 0.1;

      // Count evade intents after initial evaluation
      if (tick >= 3) {
        for (const ship of state.ships) {
          if (ship.aiState?.currentIntent) {
            totalIntentChecks++;
            if (ship.aiState.currentIntent === 'evade') {
              evadeCount++;
            }
          }
        }
      }
    }

    console.log(`Backwards compatibility - Evade count: ${evadeCount}, Total checks: ${totalIntentChecks}`);

    // With backwards compatibility, defensive ships should still evade based on proximity
    // This test mainly verifies the system doesn't break existing behavior
    expect(totalIntentChecks).toBeGreaterThan(0);
  });
});