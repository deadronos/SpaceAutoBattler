import { describe, expect, it } from 'vitest';
import { Quaternion, Vector3 } from 'three';
import { createDefaultMetrics } from '../../src/game/metrics.js';
import { resolveBehaviorProfile } from '../../src/game/aiProfiles.js';
import { generateTraitsFromSeed } from '../../src/game/aiTraits.js';
import { createDefaultMotionStats } from '../../src/game/ships.js';
import { __aiTestHooks } from '../../src/game/systems.js';
import type { BehaviorProfile, GameState, ShipEntity } from '../../src/types/index.js';
import { applyProgressionDefaults } from './helpers/progression.js';

const { writeCommand, refreshBlackboard, assignTeamRoles } = __aiTestHooks;

describe('AI vertical clamp', () => {
  it('allows agile hulls to use the expanded clamp range', () => {
    const { state, ship, target } = createStateWithShips('fighter', 'escort');
    const profile = {
      ...resolveBehaviorProfile('escort'),
      verticalManeuver: 0.7,
    } as BehaviorProfile;

    ship.ai!.intent = 'Attack';
    ship.ai!.command.heading.set(0, 0, 1);
    target.transform.position.set(0, 1000, 200);

    writeCommand(state, ship, ship.ai!, profile, target, null, null);

    const headingY = Math.abs(ship.ai!.command.heading.y);
    expect(headingY).toBeLessThanOrEqual(0.600001);
    expect(state.ai.metrics.headingAmplitudeSamples).toBeGreaterThan(0);
    expect(state.blackboard.verticalDispersion?.headingYSamples.length).toBeGreaterThan(0);
  });

  it('clamps heavy hulls to the conservative range', () => {
    const { state, ship, target } = createStateWithShips('destroyer', 'artillery');
    const profile = {
      ...resolveBehaviorProfile('artillery'),
      verticalManeuver: 0.8,
    } as BehaviorProfile;

    ship.ai!.intent = 'Attack';
    ship.ai!.command.heading.set(0, 0, 1);
    target.transform.position.set(0, 1000, 200);

    writeCommand(state, ship, ship.ai!, profile, target, null, null);

    const headingY = Math.abs(ship.ai!.command.heading.y);
    expect(headingY).toBeLessThanOrEqual(0.450001);
  });
});

function createStateWithShips(
  hull: ShipEntity['ship']['hull'],
  profileId: string,
): { state: GameState; ship: ShipEntity; target: ShipEntity } {
  const ship = {
    id: 10,
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
      hull,
      hp: 100,
      maxHp: 100,
      shield: 0,
      maxShield: 0,
      shieldRegen: 0,
      cooldown: 0,
      fireRate: 1,
      damage: 10,
      projectileSpeed: 35,
      range: 260,
      speed: 40,
      bulletType: 'bullet:laser',
      velocity: new Vector3(),
      angularVelocity: new Vector3(),
      lateralAcceleration: 0,
      motion: createDefaultMotionStats(),
    },
    model: hull,
    ai: {
      profileId,
      intent: 'Attack',
      nextThinkAt: 0,
      cooldowns: { dodgeAt: 0, burstAt: 0 },
      lod: 0,
      traitSeed: 2025,
      traits: generateTraitsFromSeed(2025),
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
    },
  } as unknown as ShipEntity;

  const target = {
    id: 11,
    rigidBody: {
      setNextKinematicTranslation: () => undefined,
      setNextKinematicRotation: () => undefined,
      translation: () => ({ x: 500, y: 0, z: 500 }),
      rotation: () => ({ x: 0, y: 0, z: 0, w: 1 }),
      linvel: () => ({ x: 0, y: 0, z: 0 }),
    } as never,
    collider: {} as never,
    transform: {
      position: new Vector3(500, 0, 500),
      rotation: new Quaternion(),
      scale: 1,
    },
    ship: {
      team: 'red',
      hull: 'corvette',
      hp: 120,
      maxHp: 120,
      shield: 0,
      maxShield: 0,
      shieldRegen: 0,
      cooldown: 0,
      fireRate: 1,
      damage: 10,
      projectileSpeed: 34,
      range: 260,
      speed: 35,
      bulletType: 'bullet:laser',
      velocity: new Vector3(),
      angularVelocity: new Vector3(),
      lateralAcceleration: 0,
      motion: createDefaultMotionStats(),
    },
    model: 'corvette',
  } as unknown as ShipEntity;

  applyProgressionDefaults(ship.ship, { maxHpOverride: ship.ship.maxHp });
  applyProgressionDefaults(target.ship, { maxHpOverride: target.ship.maxHp });

  const ships: ShipEntity[] = [ship, target];

  const state = {
    ai: {
      enabled: true,
      tickInterval: 0.1,
      tickIndex: 1,
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
      tickIndex: 1,
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
    nextEntityId: 20,
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
    },
  } as unknown as GameState;

  refreshBlackboard(state, ships);
  assignTeamRoles(state, ships);

  return { state, ship, target };
}
