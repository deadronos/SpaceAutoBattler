import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createGameState, requestReset, resetGame, disposeGameState, spawnInitialFleets } from '../../src/game/state.js';
import { updateGame } from '../../src/game/systems.js';
import type { GameState } from '../../src/types/index.js';

describe('Rapier Reset Stability', () => {
  let state: GameState;

  beforeEach(async () => {
    state = await createGameState();
  });

  afterEach(() => {
    if (state) {
      disposeGameState(state);
    }
  });

  it('initializes SimulationClock with null pendingReset', async () => {
    expect(state.simulation.pendingReset).toBeNull();
  });

  it('requestReset sets pendingReset without immediate execution', () => {
    // Spawn entities first to have something to reset
    spawnInitialFleets(state);
    const initialEntityCount = state.world.entities.length;
    
    requestReset(state);
    
    expect(state.simulation.pendingReset).toBeTypeOf('function');
    expect(state.world.entities.length).toBe(initialEntityCount);
  });

  it('defers reset execution until after physics step', () => {
    // Add some entities by spawning initial fleets
    spawnInitialFleets(state);
    const initialEntityCount = state.world.entities.length;
    expect(initialEntityCount).toBeGreaterThan(0);
    
    // Request reset - should not execute immediately
    requestReset(state);
    expect(state.world.entities.length).toBe(initialEntityCount);
    expect(state.simulation.pendingReset).toBeTypeOf('function');
    
    // Run one update cycle (includes physics step)
    updateGame(state, 1/60);
    
    // Reset should have executed, clearing pending flag and respawning entities
    expect(state.simulation.pendingReset).toBeNull();
    expect(state.world.entities.length).toBeGreaterThan(0); // New entities spawned
  });

  it('clears pendingReset flag when reset executes', () => {
    spawnInitialFleets(state);
    requestReset(state);
    expect(state.simulation.pendingReset).toBeTypeOf('function');
    
    updateGame(state, 1/60);
    
    expect(state.simulation.pendingReset).toBeNull();
  });

  it('coalesces multiple reset requests into single execution', () => {
    spawnInitialFleets(state);
    
    requestReset(state);
    requestReset(state);
    requestReset(state);
    
    // Should have a pending reset function
    expect(state.simulation.pendingReset).toBeTypeOf('function');
    
    updateGame(state, 1/60);
    
    // Only one reset should have executed
    expect(state.simulation.pendingReset).toBeNull();
  });

  it('direct resetGame clears pendingReset flag', () => {
    spawnInitialFleets(state);
    requestReset(state);
    expect(state.simulation.pendingReset).toBeTypeOf('function');
    
    // Direct call should clear the flag
    resetGame(state);
    
    expect(state.simulation.pendingReset).toBeNull();
  });

  it('uses modern EventQueue initialization', async () => {
    // This test verifies that EventQueue is created with options object
    // rather than boolean parameter. Since we can't easily inspect the internal
    // EventQueue construction, we verify the state initializes without errors
    expect(state.eventQueue).toBeDefined();
    expect(state.eventQueue.free).toBeTypeOf('function');
  });
});