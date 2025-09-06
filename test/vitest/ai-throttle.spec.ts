import { describe, it, expect, beforeEach } from 'vitest';
import { DefaultSimConfig } from '../../src/config/simConfig.js';
import type { GameState, Ship } from '../../src/types/index.js';
import { AIController } from '../../src/core/ai/controller.js';
import { DEFAULT_BEHAVIOR_CONFIG } from '../../src/config/behaviorConfig.js';

function makeState(): GameState {
  const sim = { ...DefaultSimConfig };
  const rng = { seed: 'TEST', next: () => 0.5, int: (a: number,b: number)=>a, pick: <T>(arr: readonly T[])=>arr[0] } as any;
  const state: GameState = {
    time: 0,
    tick: 0,
    running: true,
    speedMultiplier: 1,
    rng,
    nextId: 1,
    simConfig: sim,
    ships: [],
    shipDataVersion: 0,
    bullets: [],
    score: { red: 0, blue: 0 },
    behaviorConfig: DEFAULT_BEHAVIOR_CONFIG as any,
  } as any;
  state.shipIndex = new Map();
  return state;
}

function addShip(state: GameState, team: 'red'|'blue', pos = {x:0,y:0,z:0}): Ship {
  const id = state.nextId++;
  const ship: Ship = {
    id,
    team,
    class: 'fighter',
    pos: { ...pos },
    vel: { x:0,y:0,z:0 },
    orientation: { pitch:0,yaw:0,roll:0 },
    targetId: null,
    health: 100, maxHealth: 100,
    armor: 0, shield: 0, maxShield: 0, shieldRegen: 0,
    speed: 100, turnRate: 1,
    turrets: [{ id: 'T1', cooldownLeft: 0 }],
    kills: 0,
    level: { level:1, xp:0, nextLevelXp:100 },
  } as any;
  state.ships.push(ship);
  state.shipIndex!.set(id, ship);
  return ship;
}

function step(controller: AIController, state: GameState, seconds: number) {
  const dt = 1 / (state.simConfig.tickRate || 10);
  const steps = Math.round(seconds / dt);
  for (let i=0;i<steps;i++) {
    state.time += dt; state.tick += 1;
    controller.updateAllShips(dt);
  }
}

describe('AI throttling', () => {
  let state: GameState; let controller: AIController; let red: Ship; let blue: Ship;
  beforeEach(() => {
    state = makeState();
    red = addShip(state, 'red', {x:0,y:0,z:0});
    blue = addShip(state, 'blue', {x:50,y:0,z:0});
    controller = new AIController(state as any);
  });

  it('ship target switching obeys targetUpdateRate', () => {
    const rate = state.simConfig.targetUpdateRate;
    // Initial update to establish a target
    step(controller, state, rate + 0.01);
    const firstTargetTime = state.time;
    const initialTarget = red.targetId;
    expect(initialTarget).toBe(blue.id);

    // Move blue farther and add a closer enemy, but within throttle window nothing should change
    blue.pos.x = 1000;
    const closer = addShip(state, 'blue', {x:10,y:0,z:0});
    step(controller, state, rate * 0.5);
    expect(red.targetId).toBe(initialTarget);

    // After throttle window, target may switch to closer
    step(controller, state, rate + 0.01);
    expect(red.targetId === closer.id || red.targetId === initialTarget).toBe(true);
  });

  it('turret target updates obey targetUpdateRate', () => {
    const rate = state.simConfig.targetUpdateRate;
    // Establish initial turret target
    step(controller, state, rate + 0.01);
    const t = red.turrets[0];
    const first = t.aiState?.targetId ?? null;

    // Create new closer target and step less than rate; turret should not update yet
    const closer = addShip(state, 'blue', {x:5,y:0,z:0});
    step(controller, state, rate * 0.5);
    expect(t.aiState?.targetId ?? null).toBe(first);

    // After rate window, turret may update
    step(controller, state, rate + 0.01);
    const nowId = t.aiState?.targetId ?? null;
    expect(nowId === first || nowId === closer.id).toBe(true);
  });

  it('intent reevaluation obeys intentReevaluationRate', () => {
    const rate = state.simConfig.intentReevaluationRate;
    // Force a scenario where an enemy appears then disappears within the window
    step(controller, state, rate + 0.01);
    const initialIntent = red.aiState?.currentIntent ?? 'idle';

    // Change environment but step less than rate; intent should remain the same
    blue.health = 0; // remove threat
    step(controller, state, rate * 0.5);
    expect(red.aiState?.currentIntent).toBe(initialIntent);

    // After window, reevaluation may change intent
    step(controller, state, rate + 0.01);
    expect(typeof red.aiState?.currentIntent).toBe('string');
  });
});
