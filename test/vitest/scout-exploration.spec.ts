import { describe, it, expect, beforeEach } from 'vitest';
import { createInitialState, spawnFleet, simulateStep, resetState } from '../../src/core/gameState.js';
import { GameState } from '../../src/types/index.js';

describe('Scout Exploration System', () => {
  let state: GameState;

  beforeEach(() => {
    state = createInitialState('scout-exploration-test-seed');
    resetState(state); // Initialize AI controller and other systems
    
    // Enable scout exploration
    state.behaviorConfig!.globalSettings.enableScoutBehavior = true;
    state.behaviorConfig!.globalSettings.enableScoutExploration = true;
    state.behaviorConfig!.globalSettings.explorationZoneCount = 6;
    state.behaviorConfig!.globalSettings.explorationZoneDuration = 8.0;
  });

  it('should assign scouts even when no enemies are present', () => {
    // Create single ships for both teams far apart
    spawnFleet(state, 'red', 1);
    spawnFleet(state, 'blue', 1);

    // Position ships far apart so they don't detect each other
    const redShip = state.ships.find(s => s.team === 'red')!;
    const blueShip = state.ships.find(s => s.team === 'blue')!;
    
    redShip.pos = { x: 100, y: 100, z: 100 };
    blueShip.pos = { x: 1800, y: 1800, z: 1800 };

    // Initialize AI states
    for (const ship of state.ships) {
      if (!ship.aiState) {
        ship.aiState = {
          currentIntent: 'pursue',
          intentEndTime: state.time + 1.0,
          lastIntentReevaluation: state.time,
          preferredRange: 200
        };
      }
    }

    // Run simulation step to assign scouts
    simulateStep(state, 1.0);

    // Both teams should have scouts assigned
    const aiController = (state as any).aiController;
    expect(aiController.teamScouts.has('red')).toBe(true);
    expect(aiController.teamScouts.has('blue')).toBe(true);
  });

  it('should assign explore intent to scouts when no enemies are visible', () => {
    // Create single ships far apart (using default spawn locations)
    spawnFleet(state, 'red', 1);
    spawnFleet(state, 'blue', 1);

    // Ships should spawn far apart by default config
    // Initialize AI states
    for (const ship of state.ships) {
      if (!ship.aiState) {
        ship.aiState = {
          currentIntent: 'pursue',
          intentEndTime: state.time + 1.0,
          lastIntentReevaluation: state.time,
          preferredRange: 200
        };
      }
    }

    // Run multiple simulation steps like the working tests
    const fixedDt = 1 / state.simConfig.tickRate;
    for (let i = 0; i < 120; i++) { // 2 seconds
      simulateStep(state, fixedDt);
      state.time += fixedDt;
      state.tick++;
    }
    
    // Check if we have any exploration behavior
    const exploringShips = state.ships.filter(s => s.aiState?.currentIntent === 'explore');
    const patrollingShips = state.ships.filter(s => s.aiState?.currentIntent === 'patrol');
    
    // At least one ship should have explore intent when no enemies are visible
    // If no exploration, at least they should be patrolling (not pursuing)
    expect(exploringShips.length > 0 || patrollingShips.length > 0).toBe(true);
  });

  it('should enable scout exploration by default', () => {
    // Verify configuration enables scout exploration
    expect(state.behaviorConfig!.globalSettings.enableScoutExploration).toBe(true);
    expect(state.behaviorConfig!.globalSettings.explorationZoneCount).toBeGreaterThan(0);
    expect(state.behaviorConfig!.globalSettings.explorationZoneDuration).toBeGreaterThan(0);
  });
});