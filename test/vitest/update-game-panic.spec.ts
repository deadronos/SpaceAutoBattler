import { describe, expect, it, vi } from 'vite-plus/test';

vi.mock('../../src/game/systems/carriers.js', () => ({ updateCarrierLaunchSystem: vi.fn() }));
vi.mock('../../src/game/systems/motion.js', () => ({ updateMotionSystem: vi.fn() }));
vi.mock('../../src/game/explosions.js', () => ({ updateExplosions: vi.fn() }));
vi.mock('../../src/game/systems/decision/manager.js', () => ({
  updateDecisionSystem: vi.fn(),
  runDecisionTick: vi.fn(),
}));
vi.mock('../../src/game/systems/decision/blackboard.js', () => ({
  refreshBlackboard: vi.fn(),
  assignTeamRoles: vi.fn(),
}));
vi.mock('../../src/game/systems/decision/intents.js', () => ({
  selectIntent: vi.fn(),
  scoreAttackIntent: vi.fn(),
  scoreKiteIntent: vi.fn(),
  scoreEscortIntent: vi.fn(),
  scoreInterceptIntent: vi.fn(),
  scoreRepositionIntent: vi.fn(),
  scoreRegroupIntent: vi.fn(),
  scoreFleeIntent: vi.fn(),
  tieBreak: vi.fn(),
  computeLod: vi.fn(),
  writeCommand: vi.fn(),
  computeInterceptHeadingVector: vi.fn(),
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
vi.mock('../../src/game/damage.js', () => ({ resolveProjectiles: vi.fn() }));
vi.mock('../../src/game/sync.js', () => ({ syncTransforms: vi.fn() }));

import { updateGame } from '../../src/game/systems.js';
import * as simulationQueue from '../../src/game/simulationQueue.js';
import { createTestGameState } from './helpers/fixtures.js';

describe('updateGame', () => {
  it('records Rapier step panics and rethrows the original error', () => {
    const panic = new Error('rapier panic');
    const state = createTestGameState({
      physicsWorld: {
        step: vi.fn(() => {
          throw panic;
        }),
      } as never,
      eventQueue: {} as never,
    });

    state.simulation.lastTickDuration = 0.05;

    const recordSpy = vi.spyOn(simulationQueue, 'recordRapierStepPanic');

    expect(() => updateGame(state, 0.05)).toThrow(panic);
    expect(recordSpy).toHaveBeenCalledTimes(1);
    expect(recordSpy).toHaveBeenCalledWith(state, panic);

    recordSpy.mockRestore();
  });
});
