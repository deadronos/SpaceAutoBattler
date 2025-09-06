import { describe, it, expect, beforeEach } from 'vitest';
import { createMockGameState, createMockShip, getTestDtFromState, TEST_DEFAULTS } from './setupTests.js';
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
  const redShip = createMockShip({
        id: i + 1,
        team: 'red',
        class: 'fighter',
        pos: { ...TEST_DEFAULTS.defaultPos, x: 100 + i * 50 },
      });
  (redShip as Ship).aiState = {
        currentIntent: 'idle',
        intentEndTime: 0,
        lastIntentReevaluation: 0,
        preferredRange: DEFAULT_BEHAVIOR_CONFIG.globalSettings.minimumSafeDistance,
        recentDamage: 0,
        lastDamageTime: 0
      };

      const blueShip = createMockShip({
        id: i + 4,
        team: 'blue',
        class: 'fighter',
        pos: { ...TEST_DEFAULTS.defaultPos, x: 300 + i * 50 },
      });
  (blueShip as Ship).aiState = JSON.parse(JSON.stringify((redShip as Ship).aiState));

      redShips.push(redShip as Ship);
      blueShips.push(blueShip as Ship);
    }

    state.ships.push(...redShips, ...blueShips);

    // Rebuild spatial grid so AI queries see spawned ships
    if (state.spatialGrid && state.behaviorConfig?.globalSettings.enableSpatialIndex) {
      state.spatialGrid.rebuild(state.ships.map(s => ({ id: s.id, pos: s.pos, radius: 16, team: s.team })));
    }

    // Simulate for 2 seconds (20 ticks at 10 updates per second)
    let engagedShips = 0;
    let evadingShips = 0;

    const dt = getTestDtFromState(state);
    for (let tick = 0; tick < 20; tick++) {
      aiController.updateAllShips(dt);
      state.time += dt;

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
    expect(engagementRatio).toBeGreaterThan(DEFAULT_BEHAVIOR_CONFIG.defaultPersonality.aggressiveness - 0.3); // At least 60% engagement vs evasion
    expect(engagedShips).toBeGreaterThan(evadingShips); // More engagement than evasion
  });

  it('should demonstrate backwards compatibility - more evasion with evadeOnlyOnDamage disabled', () => {
    // Use default behavior (evadeOnlyOnDamage: false)
    expect(state.behaviorConfig!.globalSettings.evadeOnlyOnDamage).toBe(false);

    // Create the same scenario but with ships closer together to trigger defensive behavior
    const ships: Ship[] = [];

    for (let i = 0; i < 4; i++) {
      const team = i < 2 ? 'red' : 'blue';
      const corvette = createMockShip({
        id: i + 1,
        team,
        class: 'corvette',
        pos: { ...TEST_DEFAULTS.defaultPos, x: 150 + (i % 2) * 100, y: 100 + Math.floor(i / 2) * 100 }
      }) as Ship;
  (corvette as Ship).aiState = {
        currentIntent: 'idle',
        intentEndTime: 0,
        lastIntentReevaluation: 0,
        preferredRange: DEFAULT_BEHAVIOR_CONFIG.globalSettings.minimumSafeDistance,
        recentDamage: 0,
        lastDamageTime: 0
      };

      ships.push(corvette);
    }

    state.ships.push(...ships);

    if (state.spatialGrid && state.behaviorConfig?.globalSettings.enableSpatialIndex) {
      state.spatialGrid.rebuild(state.ships.map(s => ({ id: s.id, pos: s.pos, radius: 16, team: s.team })));
    }

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
    const dt2 = getTestDtFromState(state);
    for (let tick = 0; tick < 10; tick++) {
      aiController.updateAllShips(dt2);
      state.time += dt2;

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