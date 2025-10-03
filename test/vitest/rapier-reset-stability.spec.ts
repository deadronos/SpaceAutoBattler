import { describe, it, expect, beforeEach, afterEach } from 'vitest';
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

  it('initializes SimulationClock with empty post-step queue', () => {
    expect(state.simulation.postStepMutations).toHaveLength(0);
  });

  it('requestReset enqueues a post-step mutation without executing immediately', () => {
    spawnInitialFleets(state);
    const initialEntityCount = state.world.entities.length;

    requestReset(state);

    expect(state.simulation.postStepMutations).toHaveLength(1);
    expect(state.world.entities.length).toBe(initialEntityCount);
  });

  it('drains the post-step queue after the physics step', () => {
    spawnInitialFleets(state);
    const initialEntityCount = state.world.entities.length;
    expect(initialEntityCount).toBeGreaterThan(0);

    requestReset(state);
    expect(state.simulation.postStepMutations).toHaveLength(1);

    updateGame(state, 1 / 60);

    expect(state.simulation.postStepMutations).toHaveLength(0);
    expect(state.world.entities.length).toBeGreaterThan(0);
  });

  it('coalesces multiple reset requests into a single queued operation', () => {
    spawnInitialFleets(state);

    requestReset(state);
    requestReset(state);
    requestReset(state);

    expect(state.simulation.postStepMutations).toHaveLength(1);

    updateGame(state, 1 / 60);

    expect(state.simulation.postStepMutations).toHaveLength(0);
  });

  it('direct resetGame clears any queued post-step resets', () => {
    spawnInitialFleets(state);
    requestReset(state);
    expect(state.simulation.postStepMutations).toHaveLength(1);

    resetGame(state);

    expect(state.simulation.postStepMutations).toHaveLength(0);
  });

  it('uses modern EventQueue initialization', () => {
    expect(state.eventQueue).toBeDefined();
    expect(state.eventQueue.free).toBeTypeOf('function');
  });
});