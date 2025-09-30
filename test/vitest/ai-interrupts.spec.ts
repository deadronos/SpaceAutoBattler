import { describe, expect, it } from 'vitest';
import { Quaternion, Vector3 } from 'three';
import { createDefaultMetrics } from '../../src/game/metrics.js';
import { generateTraitsFromSeed } from '../../src/game/aiTraits.js';
import { createDefaultMotionStats } from '../../src/game/ships.js';
import { runDecisionTick, __aiTestHooks } from '../../src/game/systems.js';
import type { AIState, GameState, ShipEntity } from '../../src/types/index.js';
import { applyProgressionDefaults } from './helpers/progression.js';

const { refreshBlackboard, assignTeamRoles } = __aiTestHooks;

describe('AI interrupts', () => {
  it('skips evaluation when nextThinkAt is in the future and no interrupts are queued', () => {
    const { state, ships } = createTestState();
    const ship = ships[0];
    ship.ai!.nextThinkAt = 5;

    runDecisionTick(state, state.ai.tickInterval);

    expect(state.ai.tickIndex).toBe(1);
    expect(state.ai.metrics.lastDecisions).toBe(0);
    expect(state.ai.metrics.lastSkipped).toBe(2);
  });

  it('processes queued interrupts immediately and records latency buckets', () => {
    const { state, ships } = createTestState();
    const ship = ships[0];
    const target = ships[1];
    ship.ai!.nextThinkAt = 5;

    state.ai.interrupts?.push({
      shipId: ship.id,
      reason: 'hp-drop',
      tick: state.ai.tickIndex,
      sourceId: target.id,
    });

    runDecisionTick(state, state.ai.tickInterval);

    expect(state.ai.tickIndex).toBe(1);
    expect(state.ai.metrics.lastDecisions).toBe(1);
    expect(state.ai.metrics.lastSkipped).toBe(1);
    expect(state.ai.metrics.decisionLatencyBuckets[1]).toBe(1);
  });
});

function createTestState(): { state: GameState; ships: ShipEntity[] } {
  const ship = {
    id: 1,
    rigidBody: {
      setNextKinematicTranslation: () => undefined,
      setNextKinematicRotation: () => undefined,
      translation: () => ({ x: 0, y: 0, z: 0 }),
      rotation: () => ({ x: 0, y: 0, z: 0, w: 1 }),
      linvel: () => ({ x: 0, y: 0, z: 0 }),
    } as never,
    collider: {} as never,
    transform: {
      position: new Vector3(0, 0, 0),
      rotation: new Quaternion(),
      scale: 1,
    },
    ship: {
      team: 'blue',
      hull: 'fighter',
      hp: 60,
      maxHp: 60,
      shield: 0,
      maxShield: 0,
      shieldRegen: 0,
      cooldown: 0,
      fireRate: 1,
      damage: 6,
      projectileSpeed: 30,
      range: 260,
      speed: 40,
      bulletType: 'bullet:laser',
      velocity: new Vector3(),
      angularVelocity: new Vector3(),
      lateralAcceleration: 0,
      motion: createDefaultMotionStats(),
    },
    model: 'fighter',
    ai: {
      profileId: 'escort',
      intent: 'Attack',
      nextThinkAt: 0,
      cooldowns: { dodgeAt: 0, burstAt: 0 },
      lod: 0,
      traitSeed: 1337,
      traits: generateTraitsFromSeed(1337),
      targetId: undefined,
      lastScore: undefined,
      command: {
        heading: new Vector3(0, 0, 1),
        thrust: 0,
        firePrimary: false,
        targetId: undefined,
        ttl: 0,
      },
      stickinessUntil: 0,
      stickinessHeading: new Vector3(),
      stickinessTargetId: undefined,
      desiredRange: undefined,
    } satisfies AIState,
  } as unknown as ShipEntity;

  const enemy = {
    id: 2,
    rigidBody: {
      setNextKinematicTranslation: () => undefined,
      setNextKinematicRotation: () => undefined,
      translation: () => ({ x: 200, y: 0, z: 0 }),
      rotation: () => ({ x: 0, y: 0, z: 0, w: 1 }),
      linvel: () => ({ x: 0, y: 0, z: 0 }),
    } as never,
    collider: {} as never,
    transform: {
      position: new Vector3(200, 0, 0),
      rotation: new Quaternion(),
      scale: 1,
    },
    ship: {
      team: 'red',
      hull: 'corvette',
      hp: 80,
      maxHp: 80,
      shield: 0,
      maxShield: 0,
      shieldRegen: 0,
      cooldown: 0,
      fireRate: 1,
      damage: 6,
      projectileSpeed: 28,
      range: 260,
      speed: 38,
      bulletType: 'bullet:laser',
      velocity: new Vector3(),
      angularVelocity: new Vector3(),
      lateralAcceleration: 0,
      motion: createDefaultMotionStats(),
    },
    model: 'corvette',
  } as unknown as ShipEntity;

  applyProgressionDefaults(ship.ship, { maxHpOverride: ship.ship.maxHp });
  applyProgressionDefaults(enemy.ship, { maxHpOverride: enemy.ship.maxHp });

  const ships: ShipEntity[] = [ship, enemy];

  const state = {
    ai: {
      enabled: true,
      tickInterval: 0.1,
      tickIndex: 0,
      accumulator: 0,
      cursor: 0,
      maxPerTick: 10,
      slices: 1,
      assignments: { escorts: new Map() },
      metrics: createDefaultMetrics(),
      interrupts: [],
      interruptState: {
        cooldownTick: new Map(),
        damageThisTick: new Map(),
        lastDamageTick: -1,
        vipThreatAssignments: new Map(),
      },
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
      teamCounts: { blue: 0, red: 0 },
      verticalDispersion: {
        headingYSamples: [],
        positionYSamples: [],
        lastUpdateTick: -1,
      },
    },
    queries: {
      ships: { entities: ships },
      projectiles: { entities: [] },
      turrets: { entities: [] },
    },
    world: { entities: ships },
    physicsWorld: {} as never,
    eventQueue: {} as never,
    colliderLookup: new Map(),
    rapier: {} as never,
    nextEntityId: 10,
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
      lastTickDuration: 0,
      deferredMutations: [],
    },
  } as unknown as GameState;

  refreshBlackboard(state, ships);
  assignTeamRoles(state, ships);

  return { state, ships };
}
