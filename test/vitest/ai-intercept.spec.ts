import { describe, expect, it, vi } from 'vite-plus/test';
import { Quaternion, Vector3 } from 'three';
import { resolveBehaviorProfile } from '../../src/game/aiProfiles.js';
import { createDefaultMotionStats } from '../../src/game/ships.js';
import { __aiTestHooks } from '../../src/game/systems.js';
import { createDefaultMetrics } from '../../src/game/metrics.js';
import type { AIState, GameState, ShipEntity } from '../../src/types/index.js';
import { applyProgressionDefaults } from './helpers/progression.js';

const { selectIntent, computeInterceptHeadingVector } = __aiTestHooks;

const BASE_TRAITS = { aggression: 1, patience: 1, dodge: 1 } as const;

type ShipOptions = {
  id: number;
  team: 'blue' | 'red';
  position: Vector3;
  hull?: ShipEntity['ship']['hull'];
  hp?: number;
  maxHp?: number;
  velocity?: Vector3;
  linvel?: () => { x: number; y: number; z: number };
};

function createState(): GameState {
  return {
    ai: {
      enabled: true,
      tickInterval: 0.1,
      maxPerTick: 20,
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
      teamPriority: { blue: [], red: [] },
      priorityIndex: { blue: new Map(), red: new Map() },
      focusFire: { blue: new Map(), red: new Map() },
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
    timeScale: 1,
  } as unknown as GameState;
}

function createShip(options: ShipOptions): ShipEntity {
  const ai: AIState = {
    profileId: 'escort',
    intent: 'Attack',
    nextThinkAt: 0,
    cooldowns: { dodgeAt: 0, burstAt: 0 },
    lod: 0,
    traitSeed: 123,
    traits: { ...BASE_TRAITS },
    stickinessUntil: 0,
    stickinessHeading: new Vector3(0, 0, 1),
    command: {
      heading: new Vector3(0, 0, 1),
      thrust: 0,
      firePrimary: false,
      ttl: 0.1,
    },
  };

  const velocity = options.velocity ?? new Vector3();
  const baseMaxHp = options.maxHp ?? options.hp ?? 100;
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
      linvel: options.linvel ?? (() => ({ x: velocity.x, y: velocity.y, z: velocity.z })),
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
      hp: options.hp ?? baseMaxHp,
      maxHp: baseMaxHp,
      shield: 0,
      maxShield: 0,
      shieldRegen: 0,
      cooldown: 0,
      fireRate: 1,
      damage: 8,
      projectileSpeed: 30,
      range: 260,
      speed: 40,
      bulletType: 'bullet:laser',
      velocity: new Vector3(0, 0, 0),
      angularVelocity: new Vector3(0, 0, 0),
      lateralAcceleration: 0,
      motion: createDefaultMotionStats(),
    },
    model: options.hull ?? 'fighter',
    ai,
  } as unknown as ShipEntity;

  applyProgressionDefaults(ship.ship, { maxHpOverride: ship.ship.maxHp });
  ship.ship.velocity.copy(velocity);
  return ship;
}

describe('selectIntent with new intents', () => {
  it('chooses intercept when bomber threatens VIP', () => {
    const state = createState();
    const interceptor = createShip({ id: 1, team: 'blue', position: new Vector3(0, 0, 0) });
    interceptor.ship.projectileSpeed = 120;
    const vip = createShip({
      id: 2,
      team: 'blue',
      position: new Vector3(80, 0, 0),
      hull: 'carrier',
    });
    const bomber = createShip({
      id: 3,
      team: 'red',
      position: new Vector3(260, 0, 0),
      hull: 'corvette',
      velocity: new Vector3(-24, 0, 0),
    });
    state.blackboard.threatToVip.set(vip.id, bomber.id);
    const profile = resolveBehaviorProfile('escort');

    const intent = selectIntent(state, interceptor, interceptor.ai!, profile, bomber, null, null);

    expect(intent.intent).toBe('Intercept');
  });

  it('keeps escort priority when assigned to VIP', () => {
    const state = createState();
    const escort = createShip({ id: 4, team: 'blue', position: new Vector3(0, 0, 0) });
    const vip = createShip({
      id: 5,
      team: 'blue',
      position: new Vector3(90, 0, 0),
      hull: 'carrier',
    });
    const threat = createShip({
      id: 6,
      team: 'red',
      position: new Vector3(260, 0, 0),
      hull: 'fighter',
    });
    state.blackboard.threatToVip.set(vip.id, threat.id);
    const profile = resolveBehaviorProfile('escort');

    const intent = selectIntent(state, escort, escort.ai!, profile, threat, vip, {
      vipId: vip.id,
      offset: new Vector3(60, 0, 0),
    });

    expect(intent.intent).toBe('Escort');
  });

  it('prefers regroup when posture flips to retreat', () => {
    const state = createState();
    const ship = createShip({
      id: 7,
      team: 'blue',
      position: new Vector3(0, 0, 0),
      hp: 70,
      maxHp: 120,
    });
    state.blackboard.teamPosture.blue = 'retreat';
    state.blackboard.allyCentroid.blue.set(240, 0, 0);
    const profile = resolveBehaviorProfile('brawler');
    ship.ai!.profileId = 'brawler';

    const intent = selectIntent(state, ship, ship.ai!, profile, null, null, null);

    expect(intent.intent).toBe('Regroup');
  });

  it('uses ShipComponent velocity for intercept heading without touching Rapier', () => {
    const interceptor = createShip({ id: 8, team: 'blue', position: new Vector3(0, 0, 0) });
    interceptor.ship.projectileSpeed = 120;
    const targetVelocity = new Vector3(60, 0, 0);
    const linvelSpy = vi.fn(() => ({ x: -999, y: -999, z: -999 }));
    const target = createShip({
      id: 9,
      team: 'red',
      position: new Vector3(0, 0, 220),
      velocity: targetVelocity,
      linvel: linvelSpy,
    });

    const stationary = createShip({
      id: 12,
      team: 'red',
      position: target.transform.position.clone(),
    });

    const movingHeading = computeInterceptHeadingVector(interceptor, target, new Vector3());
    const stationaryHeading = computeInterceptHeadingVector(interceptor, stationary, new Vector3());

    expect(movingHeading.distanceTo(stationaryHeading)).toBeGreaterThan(0.01);
    expect(movingHeading.length()).toBeCloseTo(1, 5);
    expect(linvelSpy).not.toHaveBeenCalled();
  });

  it('falls back to zero velocity when ShipComponent velocity is missing', () => {
    const interceptor = createShip({ id: 10, team: 'blue', position: new Vector3(0, 0, 0) });
    const targetVelocity = new Vector3(0, 0, 0);
    const linvelSpy = vi.fn(() => ({ x: 123, y: 456, z: 789 }));
    const target = createShip({
      id: 11,
      team: 'red',
      position: new Vector3(120, 0, 0),
      velocity: targetVelocity,
      linvel: linvelSpy,
    });
    (target.ship as any).velocity = undefined;

    const result = computeInterceptHeadingVector(interceptor, target, new Vector3());

    expect(result.length()).toBeGreaterThan(0);
    expect(linvelSpy).not.toHaveBeenCalled();
  });
});
