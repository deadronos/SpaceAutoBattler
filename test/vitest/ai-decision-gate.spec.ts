import { describe, it, expect } from 'vitest';
import { AIController } from '../../src/core/aiController.js';
import { DEFAULT_BEHAVIOR_CONFIG } from '../../src/config/behaviorConfig.js';
import type { GameState, Ship } from '../../src/types/index.js';
import { createRNG } from '../../src/utils/rng.js';

function makeState(overrides?: Partial<GameState>): GameState {
  const bounds = { width: 1000, height: 800, depth: 600 };
  const base: GameState = {
    time: 0,
    tick: 0,
    running: true,
    speedMultiplier: 1,
    rng: createRNG('test-seed'),
    nextId: 1,
    simConfig: {
      simBounds: bounds,
      tickRate: 60,
      maxEntities: 1000,
      bulletLifetime: 5,
      maxSimulationSteps: 100000,
      targetUpdateRate: 0.5,
      boundaryBehavior: { ships: 'bounce', bullets: 'remove' },
      seed: 'test-seed',
      useTimeBasedSeed: false,
    },
    ships: [],
    bullets: [],
    score: { red: 0, blue: 0 },
    behaviorConfig: JSON.parse(JSON.stringify(DEFAULT_BEHAVIOR_CONFIG)),
  } as unknown as GameState;
  return Object.assign(base, overrides);
}

function makeShip(id: number, team: 'red' | 'blue', pos: {x:number;y:number;z:number}): Ship {
  return {
    id,
    team,
    class: 'fighter',
    pos: { ...pos },
    vel: { x: 0, y: 0, z: 0 },
    orientation: { pitch: 0, yaw: 0, roll: 0 },
    dir: 0,
    targetId: null,
    health: 100,
    maxHealth: 100,
    armor: 0,
    shield: 0,
    maxShield: 0,
    shieldRegen: 0,
    speed: 100,
    turnRate: Math.PI,
    turrets: [],
    kills: 0,
    level: { level: 1, xp: 0, nextLevelXp: 10 },
  } as unknown as Ship;
}

describe('DecisionEngine Evade Gate', () => {
  it('flag off: no behavior change (no forced evade)', () => {
    const state = makeState();
    // Ensure flag is false
    state.behaviorConfig.globalSettings.useDecisionEngineEvadeGate = false;

    const red = makeShip(1, 'red', { x: 200, y: 200, z: 0 });
    const blue = makeShip(2, 'blue', { x: 230, y: 200, z: 0 }); // close opponent

    state.ships = [red, blue];

    const ai = new AIController(state);

    // Set up AI state and force reevaluation
    ai.updateShipAI(red, 0.016);

    const intentBefore = red.aiState!.currentIntent;

    // Advance time to trigger reevaluation again
    state.time += 1;
    ai.updateShipAI(red, 0.016);

    const intentAfter = red.aiState!.currentIntent;

    // With flag off, legacy logic determines intent; we only assert that
    // the engine did not force an evade specifically because of DE.
    // If legacy chose something, it remains.
    expect(intentAfter).toBeTypeOf('string');
    // To be safe about flakiness, at least assert it wasn't forced from a non-evade to evade by DE
    if (intentBefore !== 'evade') {
      expect(intentAfter).not.toBe('evade');
    }
  });

  it('flag on: DE can override to evade on clear threat (non-damage-based)', () => {
    const state = makeState();
    state.behaviorConfig.globalSettings.useDecisionEngineEvadeGate = true;

    const red = makeShip(1, 'red', { x: 200, y: 200, z: 0 });
    const blue = makeShip(2, 'blue', { x: 205, y: 200, z: 0 }); // extremely close threat (distance 5)

    // Ensure reevaluation by time (not by damage), and keep recentDamage below threshold
    red.aiState = {
      currentIntent: 'idle',
      intentEndTime: 0,
      lastIntentReevaluation: 0,
      preferredRange: state.behaviorConfig.globalSettings.separationDistance,
      recentDamage: 0,
      lastDamageTime: 0,
    } as any;

    state.ships = [red, blue];

    const ai = new AIController(state);

    // Advance time beyond intentReevaluationRate to trigger reevaluation
    state.time = 2.0;
    ai.updateShipAI(red, 0.016);

    // With DE gate on and clear proximity + damage, evade is acceptable
    expect(red.aiState!.currentIntent).toBe('evade');
  });

  it('preview method returns score and wouldEvade boolean', () => {
    const state = makeState();
    const red = makeShip(1, 'red', { x: 200, y: 200, z: 0 });
    const blue = makeShip(2, 'blue', { x: 210, y: 200, z: 0 });
    state.ships = [red, blue];

    const ai = new AIController(state);
    ai.updateShipAI(red, 0.016);

    const preview = ai.previewDecisionEngineEvade(red);
    expect(typeof preview.score).toBe('number');
    expect(typeof preview.wouldEvade).toBe('boolean');
  });
});
