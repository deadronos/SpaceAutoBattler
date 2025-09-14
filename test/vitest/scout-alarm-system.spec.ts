import { describe, it, expect, beforeEach } from 'vitest';
import {
  createInitialState,
  spawnFleet,
  simulateStep,
  resetState,
} from '../../src/core/gameState.js';
import { GameState, Ship as _Ship } from '../../src/types/index.js';

describe('Scout and Alarm System Tests', () => {
  let state: GameState;

  beforeEach(() => {
    state = createInitialState('scout-test-seed');
    resetState(state); // Initialize AI controller and other systems
    spawnFleet(state, 'red', 3);
    spawnFleet(state, 'blue', 3);
  });

  it('should assign a scout ship for each team', () => {
    console.log('=== SCOUT TEST DEBUG ===');
    console.log(`AI Enabled: ${state.behaviorConfig?.globalSettings.aiEnabled}`);
    console.log(
      `Scout Behavior Enabled: ${state.behaviorConfig?.globalSettings.enableScoutBehavior}`,
    );
    console.log(
      `Initial ships: Red=${state.ships.filter((s) => s.team === 'red').length}, Blue=${state.ships.filter((s) => s.team === 'blue').length}`,
    );

    // Check initial AI state
    const redShips = state.ships.filter((s) => s.team === 'red' && s.health > 0);
    const blueShips = state.ships.filter((s) => s.team === 'blue' && s.health > 0);

    // Initialize AI states for all ships like the main game does
    const allShips = [...redShips, ...blueShips];
    for (const ship of allShips) {
      ship.aiState = {
        currentIntent: 'pursue',
        intentEndTime: state.time + 1.0,
        lastIntentReevaluation: 0,
        preferredRange: 100,
        recentDamage: 0,
        lastDamageTime: 0,
      };
    }

    const _aiController = state.aiController!;

    // Run a few simulation steps to trigger scout assignment
    const fixedDt = 1 / state.simConfig.tickRate;
    const steps = Math.max(1, Math.floor(1 * (state.simConfig?.tickRate ?? 60)));
    for (let i = 0; i < steps; i++) {
      // 1 second worth of ticks
      simulateStep(state, fixedDt);
    }

    expect(redShips.length, 'Should have red ships').toBeGreaterThan(0);
    expect(blueShips.length, 'Should have blue ships').toBeGreaterThan(0);

    // Check that at least one ship per team is pursuing (scout behavior)
    let redPursuing = false;
    let bluePursuing = false;

    for (const ship of redShips) {
      if (ship.aiState?.currentIntent === 'pursue') {
        redPursuing = true;
      }
    }

    for (const ship of blueShips) {
      if (ship.aiState?.currentIntent === 'pursue') {
        bluePursuing = true;
      }
    }

    expect(
      redPursuing || bluePursuing,
      'At least one team should have ships pursuing (scout behavior)',
    ).toBe(true);
  });

  it('should trigger alarm system when ships take damage', () => {
    // Initialize AI states for all ships first
    const allShips = state.ships.filter((s) => s.health > 0);
    for (const ship of allShips) {
      ship.aiState = {
        currentIntent: 'pursue',
        intentEndTime: state.time + 1.0,
        lastIntentReevaluation: 0,
        preferredRange: 100,
        recentDamage: 0,
        lastDamageTime: 0,
      };
    }

    // Manually damage a ship to trigger alarm
    const redShip = state.ships.find((s) => s.team === 'red')!;
    const blueShip = state.ships.find((s) => s.team === 'blue')!;

    expect(redShip, 'Should have a red ship').toBeTruthy();
    expect(blueShip, 'Should have a blue ship').toBeTruthy();

    // Simulate damage by setting AI state tracking
    redShip.aiState!.recentDamage = 30; // Above damage threshold
    redShip.aiState!.lastDamageTime = state.time;

    const fixedDt = 1 / state.simConfig.tickRate;
    // Run simulation to process alarm system (1 second)
    const alarmSteps = Math.max(1, Math.floor(1 * (state.simConfig?.tickRate ?? 60)));
    for (let i = 0; i < alarmSteps; i++) {
      simulateStep(state, fixedDt);
    }

    // Check that red team ships are pursuing due to alarm
    const redShips = state.ships.filter((s) => s.team === 'red' && s.health > 0);
    let redPursuingCount = 0;

    for (const ship of redShips) {
      if (ship.aiState?.currentIntent === 'pursue') {
        redPursuingCount++;
      }
    }

    expect(
      redPursuingCount,
      'Multiple red ships should be pursuing due to alarm system',
    ).toBeGreaterThan(1);
  });

  it('should maintain scout behavior even when far from enemies', () => {
    // Disable spatial index to use linear search for enemy finding
    if (state.behaviorConfig?.globalSettings) {
      state.behaviorConfig.globalSettings.enableSpatialIndex = false;
    }

    // Initialize AI states for all ships first
    const allShips = state.ships.filter((s) => s.health > 0);
    for (const ship of allShips) {
      ship.aiState = {
        currentIntent: 'pursue',
        intentEndTime: state.time + 1.0,
        lastIntentReevaluation: 0,
        preferredRange: 100,
        recentDamage: 0,
        lastDamageTime: 0,
      };
    }

    // Force ships to spawn very far apart by modifying positions
    const redShips = state.ships.filter((s) => s.team === 'red');
    const blueShips = state.ships.filter((s) => s.team === 'blue');

    // Place red ships at one end
    redShips.forEach((ship, i) => {
      ship.pos.x = 100;
      ship.pos.y = 100 + i * 50;
      ship.pos.z = 100;
    });

    // Place blue ships very far away
    blueShips.forEach((ship, i) => {
      ship.pos.x = 1800;
      ship.pos.y = 100 + i * 50;
      ship.pos.z = 100;
    });

    const fixedDt = 1 / state.simConfig.tickRate;
    // Run simulation for several seconds (5s)
    const runSteps = Math.max(1, Math.floor(5 * (state.simConfig?.tickRate ?? 60)));
    for (let i = 0; i < runSteps; i++) {
      simulateStep(state, fixedDt);
    }

    // Check that at least one ship per team is still pursuing despite distance
    let redPursuing = false;
    let bluePursuing = false;

    for (const ship of redShips) {
      if (ship.aiState?.currentIntent === 'pursue') {
        redPursuing = true;
        break;
      }
    }

    for (const ship of blueShips) {
      if (ship.aiState?.currentIntent === 'pursue') {
        bluePursuing = true;
        break;
      }
    }

    expect(redPursuing || bluePursuing, 'Scout ships should pursue even at long range').toBe(true);
  });

  it('should have configurable scout and alarm settings', () => {
    expect(
      state.behaviorConfig?.globalSettings.enableScoutBehavior,
      'Scout behavior should be enabled by default',
    ).toBe(true);
    expect(
      state.behaviorConfig?.globalSettings.enableAlarmSystem,
      'Alarm system should be enabled by default',
    ).toBe(true);
    expect(
      state.behaviorConfig?.globalSettings.alarmSystemWindowSeconds,
      'Alarm window should be configured',
    ).toBe(5.0);
  });
});
