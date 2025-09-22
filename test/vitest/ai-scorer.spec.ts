import { describe, expect, it } from 'vitest';
import { Quaternion, Vector3 } from 'three';
import { resolveBehaviorProfile } from '../../src/game/aiProfiles.js';
import { __aiTestHooks } from '../../src/game/systems.js';
import type { AIState, GameState, ShipEntity } from '../../src/types/index.js';

const {
  scoreAttackIntent,
  scoreKiteIntent,
  scoreEscortIntent,
  scoreFleeIntent,
  tieBreak,
} = __aiTestHooks;

const BASE_TRAITS = { aggression: 1, patience: 1, dodge: 1 } as const;

function createShip(options: {
  id: number;
  team: 'blue' | 'red';
  position: Vector3;
  hp?: number;
  maxHp?: number;
  range?: number;
  hull?: ShipEntity['ship']['hull'];
}): ShipEntity {
  const maxHp = options.maxHp ?? 120;
  const hp = options.hp ?? maxHp;
  return {
    id: options.id,
    rigidBody: {} as never,
    collider: {} as never,
    transform: {
      position: options.position.clone(),
      rotation: new Quaternion(),
      scale: 1,
    },
    ship: {
      team: options.team,
      hull: options.hull ?? 'fighter',
      hp,
      maxHp,
      shield: 0,
      maxShield: 0,
      shieldRegen: 0,
      cooldown: 0,
      fireRate: 1,
      damage: 6,
      projectileSpeed: 30,
      range: options.range ?? 260,
      speed: 40,
      bulletType: 'bullet:laser',
    },
    model: options.hull ?? 'fighter',
  } as ShipEntity;
}

function createState(): GameState {
  return {
    ai: {
      enabled: true,
      tickInterval: 0.1,
      maxPerTick: 30,
      accumulator: 0,
      tickIndex: 0,
      cursor: 0,
      slices: 1,
      assignments: { escorts: new Map() },
      metrics: {
        totalDecisions: 0,
        totalSkipped: 0,
        budgetHits: 0,
        lastDecisions: 0,
        lastSkipped: 0,
        lastSliceSize: 0,
        lastTotalShips: 0,
      },
    },
    blackboard: {
      tickIndex: 0,
      teamPosture: { blue: 'hold', red: 'hold' },
      allyCentroid: { blue: new Vector3(), red: new Vector3() },
      nearestEnemy: new Map(),
      threatToVip: new Map(),
      tmpVectors: [],
    },
    queries: { ships: { entities: [] }, projectiles: { entities: [] }, turrets: { entities: [] } },
    world: {} as never,
    physicsWorld: {} as never,
    eventQueue: {} as never,
    colliderLookup: new Map(),
    rapier: {} as never,
    nextEntityId: 1,
    time: 0,
    rng: {} as never,
    paused: false,
    timeScale: 1,
  } as unknown as GameState;
}

describe('AI scorer snapshots', () => {
  it('favors attack intent when inside desired engagement band', () => {
    const ship = createShip({ id: 1, team: 'blue', position: new Vector3(), hp: 96, maxHp: 120 });
    const target = createShip({ id: 2, team: 'red', position: new Vector3(150, 0, 0), hull: 'fighter' });
    const profile = resolveBehaviorProfile('brawler');
    const holdScore = scoreAttackIntent(ship, profile, target, 'hold', BASE_TRAITS);
    expect(holdScore).toBe(1100);

    const retreatScore = scoreAttackIntent(ship, profile, target, 'retreat', BASE_TRAITS);
    expect(retreatScore).toBe(holdScore - 120);

    const distant = createShip({ id: 3, team: 'red', position: new Vector3(400, 0, 0), hull: 'carrier' });
    const farScore = scoreAttackIntent(ship, profile, distant, 'hold', BASE_TRAITS);
    expect(holdScore).toBeGreaterThan(farScore);
  });

  it('boosts kite score when posture is retreat and hp is low', () => {
    const ship = createShip({ id: 10, team: 'red', position: new Vector3(), hp: 40, maxHp: 120, hull: 'frigate' });
    const target = createShip({ id: 11, team: 'blue', position: new Vector3(220, 0, 0), hull: 'destroyer' });
    const profile = resolveBehaviorProfile('kiter');

    const hold = scoreKiteIntent(ship, profile, target, 'hold', BASE_TRAITS);
    const retreat = scoreKiteIntent(ship, profile, target, 'retreat', BASE_TRAITS);
    expect(retreat).toBeGreaterThan(hold);
  });

  it('prioritizes escort targets threatened by VIP markers', () => {
    const state = createState();
    const escort = createShip({ id: 21, team: 'blue', position: new Vector3(0, 0, 0), hull: 'fighter' });
    const vip = createShip({ id: 22, team: 'blue', position: new Vector3(90, 0, 0), hull: 'carrier' });
    const profile = resolveBehaviorProfile('escort');

    const noThreat = scoreEscortIntent(escort, profile, vip, state, BASE_TRAITS);
    state.blackboard.threatToVip.set(vip.id, 999);
    const threatened = scoreEscortIntent(escort, profile, vip, state, BASE_TRAITS);
    expect(threatened).toBeGreaterThan(noThreat);
  });

  it('ramps flee score once hp drops below retreat gate or posture flips', () => {
    const profile = resolveBehaviorProfile('brawler');
    const shipHealthy = createShip({ id: 31, team: 'blue', position: new Vector3(), hp: 110, maxHp: 120 });
    const shipDamaged = createShip({ id: 32, team: 'blue', position: new Vector3(), hp: 20, maxHp: 120 });
    const threat = createShip({ id: 33, team: 'red', position: new Vector3(80, 0, 0) });

    const healthyScore = scoreFleeIntent(shipHealthy, profile, threat, 'hold', BASE_TRAITS);
    const damagedScore = scoreFleeIntent(shipDamaged, profile, threat, 'hold', BASE_TRAITS);
    expect(damagedScore).toBeGreaterThan(healthyScore);

    const retreatScore = scoreFleeIntent(shipHealthy, profile, threat, 'retreat', BASE_TRAITS);
    expect(retreatScore).toBeGreaterThan(healthyScore);
  });

  it('breaks intent ties deterministically using trait seed', () => {
    const ai = {
      traitSeed: 0x1a2b3c,
      traits: BASE_TRAITS,
    } as unknown as AIState;

    const candidates: Parameters<typeof tieBreak>[2] = [
      { intent: 'Attack', score: 500 },
      { intent: 'Kite', score: 500 },
      { intent: 'Escort', score: 500 },
    ];

    const first = tieBreak(ai, 12, candidates);
    const second = tieBreak(ai, 12, candidates);
    expect(first.intent).toBe(second.intent);
  });
});
