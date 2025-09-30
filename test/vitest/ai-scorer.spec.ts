import { describe, expect, it } from 'vitest';
import { Quaternion, Vector3 } from 'three';
import { resolveBehaviorProfile } from '../../src/game/aiProfiles.js';
import { createDefaultMotionStats } from '../../src/game/ships.js';
import { __aiTestHooks } from '../../src/game/systems.js';
import { createDefaultMetrics } from '../../src/game/metrics.js';
import type { AIState, GameState, ShipEntity } from '../../src/types/index.js';
import { applyProgressionDefaults } from './helpers/progression.js';

const {
  scoreAttackIntent,
  scoreKiteIntent,
  scoreEscortIntent,
  scoreInterceptIntent,
  scoreRepositionIntent,
  scoreRegroupIntent,
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
  velocity?: Vector3;
}): ShipEntity {
  const maxHp = options.maxHp ?? 120;
  const hp = options.hp ?? maxHp;
  const velocity = options.velocity ?? new Vector3();
  const ship = {
    id: options.id,
    rigidBody: {
      setNextKinematicTranslation: () => undefined,
      setNextKinematicRotation: () => undefined,
      translation: () => ({
        x: options.position.x,
        y: options.position.y,
        z: options.position.z,
      }),
      rotation: () => ({ x: 0, y: 0, z: 0, w: 1 }),
      linvel: () => ({ x: velocity.x, y: velocity.y, z: velocity.z }),
    } as never,
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
      velocity: new Vector3(0, 0, 0),
      angularVelocity: new Vector3(0, 0, 0),
      lateralAcceleration: 0,
      motion: createDefaultMotionStats(),
    },
    model: options.hull ?? 'fighter',
  } as unknown as ShipEntity;

  applyProgressionDefaults(ship.ship, { maxHpOverride: ship.ship.maxHp });
  return ship;
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
      metrics: createDefaultMetrics(),
    },
    blackboard: {
      tickIndex: 0,
      teamPosture: { blue: 'hold', red: 'hold' },
      allyCentroid: { blue: new Vector3(), red: new Vector3() },
      nearestEnemy: new Map(),
      threatToVip: new Map(),
      tmpVectors: [],
      strengthRatio: { blue: 1, red: 1 },
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
    simulation: {
      step: 1 / 20,
      accumulator: 0,
      maxSubSteps: 5,
      alpha: 0,
      lastTickIndex: 0,
      lastTickStart: 0,
      lastTickDuration: 1 / 20,
      deferredMutations: [],
      postStepMutations: [],
      rapierDiagnostics: {
        deferredMutationFailures: 0,
        guardTrips: 0,
        lastFailureTick: -1,
        lastGuardTick: -1,
        lastDeferredMutationError: undefined,
      },
    },
  } as unknown as GameState;
}

describe('AI scorer snapshots', () => {
  it('favors attack intent when inside desired engagement band', () => {
    const state = createState();
    const ship = createShip({ id: 1, team: 'blue', position: new Vector3(), hp: 96, maxHp: 120 });
    const target = createShip({ id: 2, team: 'red', position: new Vector3(150, 0, 0), hull: 'fighter' });
    const profile = resolveBehaviorProfile('brawler');
    const holdScore = scoreAttackIntent(state, ship, profile, target, 'hold', BASE_TRAITS);
    // Updated expectation: base 1136 + engagement bias 25 + opening salvo boost ~21.6 + focus bias 40 ≈ 1222.6
    expect(holdScore).toBeCloseTo(1222.6, 0);

    const retreatScore = scoreAttackIntent(state, ship, profile, target, 'retreat', BASE_TRAITS);
    expect(retreatScore).toBeCloseTo(holdScore - 120, 1);

    const distant = createShip({ id: 3, team: 'red', position: new Vector3(400, 0, 0), hull: 'carrier' });
    const farScore = scoreAttackIntent(state, ship, profile, distant, 'hold', BASE_TRAITS);
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

    const assignment = { vipId: vip.id, offset: new Vector3(50, 0, 0) };
    const noThreat = scoreEscortIntent(escort, profile, vip, state, BASE_TRAITS, assignment);
    state.blackboard.threatToVip.set(vip.id, 999);
    const threatened = scoreEscortIntent(escort, profile, vip, state, BASE_TRAITS, assignment);
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

  it('boosts intercept score for fast VIP threats', () => {
    const state = createState();
    const interceptor = createShip({ id: 41, team: 'blue', position: new Vector3(0, 0, 0), hull: 'fighter' });
    const vip = createShip({ id: 42, team: 'blue', position: new Vector3(60, 0, 0), hull: 'carrier' });
    const bomber = createShip({
      id: 43,
      team: 'red',
      position: new Vector3(320, 0, 0),
      hull: 'corvette',
      velocity: new Vector3(0, 0, -60),
    });
    state.blackboard.threatToVip.set(vip.id, bomber.id);
    const profile = resolveBehaviorProfile('escort');

    const assignment = { vipId: vip.id, offset: new Vector3(60, 0, 0) };
    const score = scoreInterceptIntent(state, interceptor, profile, bomber, vip, 'hold', BASE_TRAITS, assignment);
    const slow = createShip({ id: 44, team: 'red', position: new Vector3(220, 0, 0), hull: 'corvette' });
    const neutral = scoreInterceptIntent(state, interceptor, profile, slow, vip, 'hold', BASE_TRAITS, assignment);

    expect(score).toBeGreaterThan(neutral);
    expect(score).toBeGreaterThan(700);
  });

  it('raises reposition score for artillery outside engagement band', () => {
    const state = createState();
    const artillery = createShip({ id: 50, team: 'blue', position: new Vector3(), hull: 'destroyer' });
    const farTarget = createShip({ id: 51, team: 'red', position: new Vector3(820, 0, 0) });
    const nearTarget = createShip({ id: 52, team: 'red', position: new Vector3(420, 0, 0) });
    const profile = resolveBehaviorProfile('artillery');

    const farScore = scoreRepositionIntent(state, artillery, profile, farTarget, BASE_TRAITS, 'hold');
    const nearScore = scoreRepositionIntent(state, artillery, profile, nearTarget, BASE_TRAITS, 'hold');

    expect(farScore).toBeGreaterThan(nearScore);
    expect(farScore).toBeGreaterThan(nearScore + 100);
  });

  it('prefers regroup when posture retreats even at moderate hp', () => {
    const state = createState();
    state.blackboard.teamPosture.blue = 'retreat';
    state.blackboard.allyCentroid.blue.set(240, 0, 0);
    const profile = resolveBehaviorProfile('brawler');
    const ship = createShip({ id: 60, team: 'blue', position: new Vector3(0, 0, 0), hp: 80, maxHp: 120 });

    const regroup = scoreRegroupIntent(state, ship, profile, 'retreat', BASE_TRAITS);
    const hold = scoreRegroupIntent(state, ship, profile, 'hold', BASE_TRAITS);

    expect(regroup).toBeGreaterThan(hold);
    expect(regroup).toBeGreaterThan(600);
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

  it('applies engagement bias to attack intent scores', () => {
    const state = createState();
    const ship = createShip({ id: 1, team: 'blue', position: new Vector3() });
    const target = createShip({ id: 2, team: 'red', position: new Vector3(150, 0, 0) });
    const baseProfile = resolveBehaviorProfile('brawler');
    const baseBias = baseProfile.engagementBias ?? 0;
    const lowBiasProfile = { ...baseProfile, engagementBias: baseBias - 10 };
    const highBiasProfile = { ...baseProfile, engagementBias: baseBias + 10 };

    const lowScore = scoreAttackIntent(state, ship, lowBiasProfile, target, 'hold', BASE_TRAITS);
    const highScore = scoreAttackIntent(state, ship, highBiasProfile, target, 'hold', BASE_TRAITS);

    expect(highScore).toBeGreaterThan(lowScore);
  });

  it('applies opening salvo aggression boost during initial period', () => {
    const ship = createShip({ id: 1, team: 'blue', position: new Vector3() });
    const target = createShip({ id: 2, team: 'red', position: new Vector3(150, 0, 0) });
    const profile = resolveBehaviorProfile('brawler');

    // Test during opening salvo (time=0)
    const earlyState = createState();
    earlyState.time = 0;
    const earlyScore = scoreAttackIntent(earlyState, ship, profile, target, 'hold', BASE_TRAITS);

    // Test after opening salvo period (time=35s > 30s duration)
    const lateState = createState();
    lateState.time = 35;
    const lateScore = scoreAttackIntent(lateState, ship, profile, target, 'hold', BASE_TRAITS);

    // Early score should be higher due to opening salvo aggression boost
    expect(earlyScore).toBeGreaterThan(lateScore);

    // The difference should be approximately the aggression boost difference
    // aggression * 120 * (1.2 - 1.0) = 0.9 * 1 * 120 * 0.2 = 21.6
    expect(earlyScore - lateScore).toBeCloseTo(21.6, 1);
  });

  it('applies opening salvo boost to intercept intent as well', () => {
    const ship = createShip({ id: 1, team: 'blue', position: new Vector3() });
    const target = createShip({ id: 2, team: 'red', position: new Vector3(300, 0, 0) });
    const profile = resolveBehaviorProfile('escort');

    // Test during opening salvo
    const earlyState = createState();
    earlyState.time = 0;
    const earlyScore = scoreInterceptIntent(earlyState, ship, profile, target, null, 'hold', BASE_TRAITS, null);

    // Test after opening salvo period
    const lateState = createState();
    lateState.time = 35;
    const lateScore = scoreInterceptIntent(lateState, ship, profile, target, null, 'hold', BASE_TRAITS, null);

    // Early score should be higher due to opening salvo boost
    expect(earlyScore).toBeGreaterThan(lateScore);
  });
});

