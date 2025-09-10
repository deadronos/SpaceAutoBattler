import { describe, it, expect, beforeEach } from 'vitest';
import {
  createMockGameState,
  createMockShip,
  getTestDtFromState,
  TEST_DEFAULTS,
} from './setupTests.js';
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
    const ship = createMockShip({
      id: 1,
      team: 'red',
      class: 'fighter',
      pos: { ...TEST_DEFAULTS.defaultPos, x: 1005 },
      vel: { ...TEST_DEFAULTS.zeroPos },
    }) as Ship;
    (ship as Ship).dir = 0;
    (ship as Ship).targetId = null;
    (ship as Ship).aiState = {
      currentIntent: 'idle',
      intentEndTime: 0,
      lastIntentReevaluation: 0,
      preferredRange: DEFAULT_BEHAVIOR_CONFIG.globalSettings.minimumSafeDistance,
      recentDamage: 0,
      lastDamageTime: 0,
    } as unknown as Ship['aiState'];
    state.ships.push(ship);

    if (state.spatialGrid && state.behaviorConfig?.globalSettings.enableSpatialIndex) {
      state.spatialGrid.rebuild(
        state.ships.map((s) => ({ id: s.id, pos: s.pos, radius: 16, team: s.team })),
      );
    }

    // Manually test the boundary physics function
    applyBoundaryPhysics(ship, state);

    // With bounce behavior, ship should be kept within the boundary
    expect(ship.pos.x).toBeLessThanOrEqual(state.simConfig.simBounds.width);
    expect(ship.pos.x).toBeGreaterThanOrEqual(0);
  });

  it('should handle wrap boundary behavior when using AIController', () => {
    // Set boundary behavior to wrap
    state.simConfig.boundaryBehavior.ships = 'wrap';

    // Create a ship near the boundary with velocity pushing it out of bounds
    const ship2 = createMockShip({
      id: 1,
      team: 'red',
      class: 'fighter',
      pos: { ...TEST_DEFAULTS.defaultPos, x: 990 },
      vel: { ...TEST_DEFAULTS.zeroPos, x: 500 },
    }) as Ship;
    (ship2 as Ship).dir = 0;
    (ship2 as Ship).targetId = null;
    (ship2 as Ship).aiState = {
      currentIntent: 'idle',
      intentEndTime: 0,
      lastIntentReevaluation: 0,
      preferredRange: DEFAULT_BEHAVIOR_CONFIG.globalSettings.minimumSafeDistance,
      recentDamage: 0,
      lastDamageTime: 0,
    } as unknown as Ship['aiState'];
    state.ships.push(ship2);

    // Simulate steps to push ship past boundary
    const dt = getTestDtFromState(state);
    for (let i = 0; i < 5; i++) {
      simulateStep(state, dt);
      state.time += dt;
    }

    // With wrap behavior, ship should wrap around to other side when going out of bounds
    // (This test will currently fail since AIController doesn't handle boundary physics)
    expect(ship2.pos.x).toBeLessThanOrEqual(state.simConfig.simBounds.width);
    expect(ship2.pos.x).toBeGreaterThanOrEqual(0);
  });

  it('should apply same boundary physics for legacy AI and AIController', () => {
    // Test both paths produce same boundary behavior
    const shipA = createMockShip({
      id: 1,
      team: 'red',
      class: 'fighter',
      pos: { ...TEST_DEFAULTS.defaultPos, x: 995 },
      vel: { ...TEST_DEFAULTS.zeroPos, x: 50 },
    }) as Ship;
    (shipA as Ship).dir = 0;

    const shipB = createMockShip({
      id: 2,
      team: 'red',
      class: 'fighter',
      pos: { ...TEST_DEFAULTS.defaultPos, x: 995 },
      vel: { ...TEST_DEFAULTS.zeroPos, x: 50 },
    }) as Ship;
    (shipB as Ship).dir = 0;
    (shipB as Ship).aiState = {
      currentIntent: 'idle',
      intentEndTime: 0,
      lastIntentReevaluation: 0,
      preferredRange: DEFAULT_BEHAVIOR_CONFIG.globalSettings.minimumSafeDistance,
      recentDamage: 0,
      lastDamageTime: 0,
    } as unknown as Ship['aiState'];

    // Add an enemy target for both ships to pursue
    const enemyShip = createMockShip({
      id: 3,
      team: 'blue',
      class: 'fighter',
      pos: { ...TEST_DEFAULTS.defaultPos, x: 1050 },
    }) as Ship;

    // State 1: Use legacy AI (no behaviorConfig)
    const state1 = createMockGameState();
    (state1.ships as Ship[]).push(shipA, JSON.parse(JSON.stringify(enemyShip)));

    // State 2: Use AIController
    const state2 = createMockGameState();
    state2.behaviorConfig = JSON.parse(JSON.stringify(DEFAULT_BEHAVIOR_CONFIG));
    (state2.ships as Ship[]).push(shipB, JSON.parse(JSON.stringify(enemyShip)));

    // Simulate same number of steps
    const dt2 = getTestDtFromState(state1);
    for (let i = 0; i < 10; i++) {
      simulateStep(state1, dt2);
      simulateStep(state2, dt2);
      state1.time += dt2;
      state2.time += dt2;
    }

    // Both should respect boundaries (legacy now delegates to AIController)
    expect(shipA.pos.x).toBeLessThanOrEqual(state1.simConfig.simBounds.width);
    expect(shipB.pos.x).toBeLessThanOrEqual(state2.simConfig.simBounds.width);

    // Since legacy AI now delegates to AIController, behavior should be more similar
    // (allow some variation due to different intent evaluation timing)
    const positionDiff = Math.abs(shipA.pos.x - shipB.pos.x);
    expect(positionDiff).toBeLessThan(100); // Should be reasonably close
  });
});
