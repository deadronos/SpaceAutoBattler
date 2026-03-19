import { describe, expect, it, vi, beforeEach, afterAll } from 'vite-plus/test';

import { updateGame } from '../../src/game/systems.js';
import * as simulationQueue from '../../src/game/simulationQueue.js';
import { createTestGameState } from './helpers/fixtures.js';

import { updateDecisionSystem } from '../../src/game/systems/decision/manager.js';
vi.mock('../../src/game/systems/decision/manager.js', () => ({
  updateDecisionSystem: vi.fn(),
  runDecisionTick: vi.fn(),
}));
vi.mock('../../src/game/systems/carriers.js', () => ({
  updateCarrierLaunchSystem: vi.fn(),
}));
vi.mock('../../src/game/systems/motion.js', () => ({
  updateMotionSystem: vi.fn(),
}));
vi.mock('../../src/game/systems/shipControl.js', () => ({
  prepareShips: vi.fn(),
  executeAICommand: vi.fn(),
}));
vi.mock('../../src/game/systems/projectiles.js', () => ({
  fireProjectile: vi.fn(),
  advanceProjectiles: vi.fn(),
}));
vi.mock('../../src/game/systems/turrets.js', () => ({
  findNearestEnemy: vi.fn(),
  updateTurrets: vi.fn(),
}));
vi.mock('../../src/game/sync.js', () => ({
  syncTransforms: vi.fn(),
}));
vi.mock('../../src/game/damage.js', () => ({
  resolveProjectiles: vi.fn(),
}));
vi.mock('../../src/game/explosions.js', () => ({
  updateExplosions: vi.fn(),
}));

const updateDecisionSystemMock = vi.mocked(updateDecisionSystem);

describe('updateGame profiling', () => {
  const nowSpy = vi.spyOn(globalThis.performance, 'now');

  beforeEach(() => {
    nowSpy.mockClear();
    updateDecisionSystemMock.mockReset();
  });

  afterAll(() => {
    nowSpy.mockRestore();
  });

  it('skips subsystem profiling when disabled', () => {
    const state = createTestGameState({
      physicsWorld: { step: vi.fn() } as never,
      eventQueue: {} as never,
    });

    state.simulation.profileSubsystems = false;
    state.simulation.profileSampleRate = 1;
    state.simulation.enableSubsystemGuards = true;

    updateGame(state, 0.05);

    expect(nowSpy).toHaveBeenCalledTimes(2);
    expect(state.simulation.subsystemTimings?.durations).not.toHaveProperty('updateDecisionSystem');
  });

  it('profiles every Nth tick according to sample rate', () => {
    const state = createTestGameState({
      physicsWorld: { step: vi.fn() } as never,
      eventQueue: {} as never,
    });

    state.simulation.profileSubsystems = true;
    state.simulation.profileSampleRate = 2;

    updateGame(state, 0.05);
    expect(nowSpy).toHaveBeenCalledTimes(2);

    nowSpy.mockClear();
    updateGame(state, 0.05);
    expect(nowSpy).toHaveBeenCalledTimes(24);
    expect(state.simulation.subsystemTimings?.durations).toHaveProperty('updateDecisionSystem');
  });
});

describe('updateGame subsystem guards', () => {
  beforeEach(() => {
    updateDecisionSystemMock.mockReset();
  });

  it('records failures when guards are enabled', () => {
    const state = createTestGameState({
      physicsWorld: { step: vi.fn() } as never,
      eventQueue: {} as never,
    });
    state.simulation.enableSubsystemGuards = true;

    const error = new Error('boom');
    updateDecisionSystemMock.mockImplementation(() => {
      throw error;
    });

    const recordSpy = vi.spyOn(simulationQueue, 'recordSubsystemFailure');
    expect(() => updateGame(state, 0.05)).not.toThrow();
    expect(recordSpy).toHaveBeenCalledWith(state, 'updateDecisionSystem', error, expect.anything());
    recordSpy.mockRestore();
  });

  it('propagates exceptions when guards are disabled', () => {
    const state = createTestGameState({
      physicsWorld: { step: vi.fn() } as never,
      eventQueue: {} as never,
    });
    state.simulation.enableSubsystemGuards = false;

    const error = new Error('boom');
    updateDecisionSystemMock.mockImplementation(() => {
      throw error;
    });

    expect(() => updateGame(state, 0.05)).toThrow(error);
  });
});
