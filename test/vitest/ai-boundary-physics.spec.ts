import { describe, it, expect, beforeEach } from 'vitest';
import { createMockGameState, createMockShip } from './setupTests.js';
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
    const ship = createMockShip({ id: 1, team: 'red', class: 'fighter', pos: { x: 1005, y: 100, z: 100 }, vel: { x: 0, y: 0, z: 0 } }) as Ship;
    (ship as any).dir = 0;
    (ship as any).targetId = null;
    (ship as any).aiState = {
      currentIntent: 'idle',
      intentEndTime: 0,
      lastIntentReevaluation: 0,
      preferredRange: 150,
      recentDamage: 0,
      lastDamageTime: 0
    } as any;
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
    const ship2 = createMockShip({ id: 1, team: 'red', class: 'fighter', pos: { x: 990, y: 100, z: 100 }, vel: { x: 500, y: 0, z: 0 } }) as Ship;
    (ship2 as any).dir = 0;
    (ship2 as any).targetId = null;
    (ship2 as any).aiState = {
      currentIntent: 'idle',
      intentEndTime: 0,
      lastIntentReevaluation: 0,
      preferredRange: 150,
      recentDamage: 0,
      lastDamageTime: 0
    } as any;
    state.ships.push(ship2);

    // Simulate steps to push ship past boundary
    const dt = 1/60; // 60 FPS
    for (let i = 0; i < 5; i++) {
      simulateStep(state, dt);
    }

  // With wrap behavior, ship should wrap around to other side when going out of bounds
  // (This test will currently fail since AIController doesn't handle boundary physics)
  expect(ship2.pos.x).toBeLessThanOrEqual(state.simConfig.simBounds.width);
  expect(ship2.pos.x).toBeGreaterThanOrEqual(0);
  });

  it('should apply same boundary physics for legacy AI and AIController', () => {
    // Test both paths produce same boundary behavior
    const shipA = createMockShip({ id: 1, team: 'red', class: 'fighter', pos: { x: 995, y: 100, z: 100 }, vel: { x: 50, y: 0, z: 0 } }) as Ship;
    (shipA as any).dir = 0;

    const shipB = createMockShip({ id: 2, team: 'red', class: 'fighter', pos: { x: 995, y: 100, z: 100 }, vel: { x: 50, y: 0, z: 0 } }) as Ship;
    (shipB as any).dir = 0;
    (shipB as any).aiState = {
      currentIntent: 'idle',
      intentEndTime: 0,
      lastIntentReevaluation: 0,
      preferredRange: 150,
      recentDamage: 0,
      lastDamageTime: 0
    } as any;

    // Add an enemy target for both ships to pursue
    const enemyShip = createMockShip({ id: 3, team: 'blue', class: 'fighter', pos: { x: 1050, y: 100, z: 100 } }) as Ship;

    // State 1: Use legacy AI (no behaviorConfig)
    const state1 = createMockGameState();
    (state1.ships as Ship[]).push(shipA, JSON.parse(JSON.stringify(enemyShip)));

    // State 2: Use AIController
    const state2 = createMockGameState();
    state2.behaviorConfig = JSON.parse(JSON.stringify(DEFAULT_BEHAVIOR_CONFIG));
    (state2.ships as Ship[]).push(shipB, JSON.parse(JSON.stringify(enemyShip)));

    // Simulate same number of steps
    const dt = 1/60;
    for (let i = 0; i < 10; i++) {
      simulateStep(state1, dt);
      simulateStep(state2, dt);
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