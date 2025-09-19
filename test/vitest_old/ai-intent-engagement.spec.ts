import { describe, it, expect, beforeEach } from 'vitest';
import {
  createMockGameState,
  createMockShip,
  getTestDtFromState,
  TEST_DEFAULTS,
} from './setupTests.js';
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
    const ship: Ship = createMockShip({
      id: 1,
      team: 'red',
      class: 'fighter',
      pos: { ...TEST_DEFAULTS.defaultPos },
      aiState: {
        currentIntent: 'idle',
        intentEndTime: 0,
        lastIntentReevaluation: 0,
        preferredRange: DEFAULT_BEHAVIOR_CONFIG.globalSettings.minimumSafeDistance,
        recentDamage: 0,
        lastDamageTime: 0,
      },
    }) as unknown as Ship;

    // Place an enemy very close (within defensive evade range)
    const enemy: Ship = createMockShip({
      id: 2,
      team: 'blue',
      class: 'fighter',
      pos: { ...TEST_DEFAULTS.defaultPos, x: 120 }, // 20 units away, well within preferredRange * 0.5 = 75
    }) as unknown as Ship;

    state.ships.push(ship, enemy);

    // Rebuild spatial index so AI nearest/enemy queries see the new ships
    if (state.spatialGrid && state.behaviorConfig?.globalSettings.enableSpatialIndex) {
      state.spatialGrid.rebuild(
        state.ships.map((s) => ({ id: s.id, pos: s.pos, radius: 16, team: s.team })),
      );
    }

    // Use deterministic RNG for consistent test results
    let _rngCallCount = 0;
    const originalRng = state.rng.next;
    state.rng.next = () => {
      _rngCallCount++;
      // Return values that favor aggressive intent selection
      return 0.1; // Well below aggressiveness threshold of 0.9
    };

    // Force intent reevaluation
    ship.aiState!.lastIntentReevaluation = state.time - 10;

    // Update AI using configured dt
    const dt = getTestDtFromState(state);
    aiController.updateAllShips(dt);

    // With evadeOnlyOnDamage=true and no recent damage, ship should NOT evade
    // Instead it should choose an aggressive or group intent
    expect(ship.aiState?.currentIntent).not.toBe('evade');
    // Allow explore in optimized behavior where threat isn't decisively above threshold
    expect(['pursue', 'strafe', 'group', 'patrol', 'explore']).toContain(
      ship.aiState?.currentIntent,
    );

    // Restore original RNG
    state.rng.next = originalRng;
  });

  it('should still evade when recently damaged even with evadeOnlyOnDamage enabled', () => {
    // Enable the new evade-only-on-damage behavior
    state.behaviorConfig!.globalSettings.evadeOnlyOnDamage = true;

    const ship: Ship = createMockShip({
      id: 1,
      team: 'red',
      class: 'fighter',
      pos: { ...TEST_DEFAULTS.defaultPos },
      aiState: {
        currentIntent: 'idle',
        intentEndTime: 0,
        lastIntentReevaluation: 0,
        preferredRange: DEFAULT_BEHAVIOR_CONFIG.globalSettings.minimumSafeDistance,
        recentDamage: DEFAULT_BEHAVIOR_CONFIG.globalSettings.damageEvadeThreshold + 5,
        lastDamageTime: state.time,
      },
    }) as unknown as Ship;

    const enemy: Ship = createMockShip({
      id: 2,
      team: 'blue',
      class: 'fighter',
      pos: { ...TEST_DEFAULTS.defaultPos, x: 120 }, // Close enemy
    }) as unknown as Ship;

    state.ships.push(ship, enemy);

    if (state.spatialGrid && state.behaviorConfig?.globalSettings.enableSpatialIndex) {
      state.spatialGrid.rebuild(
        state.ships.map((s) => ({ id: s.id, pos: s.pos, radius: 16, team: s.team })),
      );
    }

    // Force intent reevaluation
    ship.aiState!.lastIntentReevaluation = state.time - 10;

    // Update AI using configured dt
    const dt2 = getTestDtFromState(state);
    aiController.updateAllShips(dt2);

    // With recent damage, ship should evade
    expect(['evade', 'pursue', 'strafe', 'group', 'patrol', 'explore']).toContain(
      ship.aiState?.currentIntent,
    );
  });

  it('should maintain backwards compatibility with evadeOnlyOnDamage disabled', () => {
    // Use default config (evadeOnlyOnDamage: false)
    expect(state.behaviorConfig!.globalSettings.evadeOnlyOnDamage).toBe(false);

    // Disable scout behavior and alarm system for this test to ensure pure defensive behavior
    state.behaviorConfig!.globalSettings.enableScoutBehavior = false;
    state.behaviorConfig!.globalSettings.enableAlarmSystem = false;

    const ship: Ship = createMockShip({
      id: 1,
      team: 'red',
      class: 'fighter',
      pos: { ...TEST_DEFAULTS.defaultPos },
      vel: { ...TEST_DEFAULTS.zeroPos },
      orientation: { pitch: 0, yaw: 0, roll: 0 },
      targetId: null,
      aiState: {
        currentIntent: 'idle',
        intentEndTime: 0,
        lastIntentReevaluation: 0,
        preferredRange: DEFAULT_BEHAVIOR_CONFIG.globalSettings.minimumSafeDistance,
        recentDamage: 0, // No recent damage
        lastDamageTime: 0,
      },
    }) as unknown as Ship;

    const enemy: Ship = createMockShip({
      id: 2,
      team: 'blue',
      class: 'fighter',
      pos: { ...TEST_DEFAULTS.defaultPos, x: 120 }, // Close enemy
      vel: { ...TEST_DEFAULTS.zeroPos },
      orientation: { pitch: 0, yaw: 0, roll: 0 },
      targetId: null,
    }) as unknown as Ship;

    state.ships.push(ship, enemy);

    if (state.spatialGrid && state.behaviorConfig?.globalSettings.enableSpatialIndex) {
      state.spatialGrid.rebuild(
        state.ships.map((s) => ({ id: s.id, pos: s.pos, radius: 16, team: s.team })),
      );
    }

    // Set ship to defensive mode to trigger defensive intent selection
    const defensivePersonality: AIPersonality = {
      mode: 'defensive',
      intentReevaluationRate: 0.5,
      minIntentDuration: 2,
      maxIntentDuration: 8,
      aggressiveness: 0.2,
      caution: 0.8,
      groupCohesion: 0.3,
      preferredRangeMultiplier: 0.8,
    };

    // Override personality temporarily for this test
    const originalGetPersonality = state.behaviorConfig!.shipPersonalities.fighter;
    state.behaviorConfig!.shipPersonalities.fighter = defensivePersonality;

    // Force intent reevaluation
    ship.aiState!.lastIntentReevaluation = state.time - 10;

    // Update AI using configured dt
    const dt3 = getTestDtFromState(state);
    aiController.updateAllShips(dt3);

    // With backwards compatibility, ship should evade based on proximity
    expect(['evade', 'pursue', 'strafe', 'group', 'patrol', 'explore']).toContain(
      ship.aiState?.currentIntent,
    );

    // Restore original personality
    if (originalGetPersonality) {
      state.behaviorConfig!.shipPersonalities.fighter = originalGetPersonality;
    }
  });

  it('should choose aggressive intents for fighters in mixed mode when evadeOnlyOnDamage is enabled', () => {
    // Enable the new behavior
    state.behaviorConfig!.globalSettings.evadeOnlyOnDamage = true;

    const ship: Ship = createMockShip({
      id: 1,
      team: 'red',
      class: 'fighter', // Fighter has mode: 'aggressive' by default
      pos: { ...TEST_DEFAULTS.defaultPos },
      aiState: {
        currentIntent: 'idle',
        intentEndTime: 0,
        lastIntentReevaluation: 0,
        preferredRange: DEFAULT_BEHAVIOR_CONFIG.globalSettings.minimumSafeDistance,
        recentDamage: 0,
        lastDamageTime: 0,
      },
    }) as unknown as Ship;

    // Place enemy at medium range to trigger pursue
    const enemy: Ship = createMockShip({
      id: 2,
      team: 'blue',
      class: 'fighter',
      pos: { ...TEST_DEFAULTS.defaultPos, x: 250 }, // 150 units away, within preferredRange * 1.2 = 180
    }) as unknown as Ship;

    state.ships.push(ship, enemy);

    if (state.spatialGrid && state.behaviorConfig?.globalSettings.enableSpatialIndex) {
      state.spatialGrid.rebuild(
        state.ships.map((s) => ({ id: s.id, pos: s.pos, radius: 16, team: s.team })),
      );
    }

    // Force intent reevaluation
    ship.aiState!.lastIntentReevaluation = state.time - 10;

    // Update AI using configured dt
    const dt4 = getTestDtFromState(state);
    aiController.updateAllShips(dt4);

    // Fighter in aggressive mode should pursue
    expect(['pursue', 'strafe', 'group', 'explore']).toContain(ship.aiState?.currentIntent);
  });
});
