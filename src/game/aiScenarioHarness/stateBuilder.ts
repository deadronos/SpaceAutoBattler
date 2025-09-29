import { Quaternion, Vector3 } from 'three';
import type { AIState, GameState, ShipEntity } from '../../types/index.js';
import { createDefaultMotionStats } from '../ships.js';
import type { SeededRng } from '../../utils/rng.js';
import { AI_CONFIG } from '../config.js';
import { getDefaultProfileId } from '../aiProfiles.js';
import { generateTraitsFromSeed } from '../aiTraits.js';
import { createDefaultMetrics } from '../metrics.js';
import { createProgressionDefaults, createSubsystems } from '../progression.js';
import type {
  AIScenarioShipConfig,
  HarnessGameState,
  HarnessQueries,
  HarnessShip,
} from './types.js';

export function createHarnessShip(
  spec: AIScenarioShipConfig,
  index: number,
  rng: SeededRng,
  tickInterval: number,
): HarnessShip {
  const id = spec.id ?? index + 1;
  const position = new Vector3(...spec.position);
  const rotation = new Quaternion();
  const hull = spec.hull;
  const profileId = spec.profileId ?? getDefaultProfileId(hull);
  const traitSeed = spec.traitSeed ?? rng.int(1, 1_000_000);
  const maxHp = spec.maxHp ?? spec.hp ?? 100;
  const hp = spec.hp ?? maxHp;
  const maxShield = spec.maxShield ?? spec.shield ?? 0;
  const shield = spec.shield ?? maxShield;
  const progression = createProgressionDefaults(hull);
  const subsystems = createSubsystems(maxHp);

  const ai: AIState = {
    profileId,
    intent: 'Attack',
    nextThinkAt: 0,
    cooldowns: { dodgeAt: 0, burstAt: 0 },
    lod: 0,
    traitSeed,
    traits: generateTraitsFromSeed(traitSeed),
    stickinessUntil: 0,
    stickinessHeading: new Vector3(0, 0, 1),
    targetId: undefined,
    lastScore: undefined,
    command: {
      heading: new Vector3(0, 0, 1),
      thrust: 0,
      firePrimary: false,
      ttl: tickInterval,
    },
  };

  const ship: HarnessShip = {
    id,
    rigidBody: createRigidBodyShim(position, rotation, spec.velocity),
    collider: {} as never,
    transform: { position, rotation, scale: 1 },
    ship: {
      team: spec.team,
      hull,
      xp: progression.xp,
      level: progression.level,
      xpToNext: progression.xpToNext,
      damageType: progression.damageType,
      levelBonuses: progression.levelBonuses,
      captain: progression.captain,
      subsystems,
      armor: progression.armor,
      hp,
      maxHp,
      shield,
      maxShield,
      shieldRegen: 0,
      cooldown: 0,
      fireRate: spec.fireRate ?? 0.8,
      damage: 8,
      projectileSpeed: spec.projectileSpeed ?? 30,
      range: spec.range ?? 260,
      speed: spec.speed ?? 40,
      bulletType: spec.bulletType ?? 'bullet:laser',
      velocity: new Vector3(0, 0, 0),
      angularVelocity: new Vector3(0, 0, 0),
      lateralAcceleration: 0,
      motion: createDefaultMotionStats(),
    },
    model: hull,
    ai,
  } as HarnessShip;

  if (spec.velocity) {
    ship.__harnessVelocity = new Vector3(...spec.velocity);
  }

  return ship;
}

export function createHarnessState(options: {
  ships: HarnessShip[];
  tickInterval: number;
  rng: SeededRng;
  aiEnabled: boolean;
}): HarnessGameState {
  const { ships, tickInterval, rng, aiEnabled } = options;

  const queries: HarnessQueries = {
    ships: { entities: ships },
    projectiles: { entities: [] },
    turrets: { entities: [] },
  };

  const world = {
    entities: ships,
    createEntity: (entity: unknown) => {
      (queries.projectiles.entities as unknown[]).push(entity);
      return entity as ShipEntity;
    },
    add: (entity: unknown) => {
      (queries.projectiles.entities as unknown[]).push(entity);
      return entity as ShipEntity;
    },
    destroyEntity: () => undefined,
    remove: () => undefined,
  } as unknown as GameState['world'];

  const physicsWorld = {
    createRigidBody: (desc: {
      translation: { x: number; y: number; z: number };
      rotation: { x: number; y: number; z: number; w: number };
    }) => ({
      translation: () => ({ ...desc.translation }),
      rotation: () => ({ ...desc.rotation }),
      setNextKinematicTranslation: () => undefined,
      setNextKinematicRotation: () => undefined,
    }),
    createCollider: (desc: { radius?: number }, body: unknown) => ({
      handle: Math.random(),
      radius: desc.radius ?? 0,
      body,
    }),
  } as never;

  const rapier = {
    RigidBodyDesc: {
      kinematicPositionBased: () => ({
        translation: { x: 0, y: 0, z: 0 },
        rotation: { x: 0, y: 0, z: 0, w: 1 },
        setTranslation(x: number, y: number, z: number) {
          this.translation = { x, y, z };
          return this;
        },
        setRotation(rotation: { x: number; y: number; z: number; w: number }) {
          this.rotation = { ...rotation };
          return this;
        },
      }),
    },
    ColliderDesc: {
      ball: (radius: number) => ({
        radius,
        setActiveEvents() {
          return this;
        },
        setActiveCollisionTypes() {
          return this;
        },
      }),
    },
    ActiveEvents: { COLLISION_EVENTS: 0 },
    ActiveCollisionTypes: { ALL: 0 },
  } as never;

  const state = {
    ai: {
      enabled: aiEnabled,
      tickInterval,
      maxPerTick: AI_CONFIG.maxPerTick,
      accumulator: 0,
      tickIndex: 0,
      cursor: 0,
      slices: AI_CONFIG.slices,
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
      tmpVectors: [new Vector3(), new Vector3(), new Vector3(), new Vector3()],
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
    queries,
    world,
    physicsWorld,
    eventQueue: {} as never,
    colliderLookup: new Map(),
    rapier,
    nextEntityId: ships.length + 1,
    time: 0,
    rng,
    paused: false,
    timeScale: 1,
  } as unknown as HarnessGameState;

  return state;
}

function createRigidBodyShim(
  position: Vector3,
  rotation: Quaternion,
  velocity?: readonly [number, number, number],
) {
  const vel = velocity ? new Vector3(...velocity) : new Vector3();
  return {
    setNextKinematicTranslation: ({ x, y, z }: { x: number; y: number; z: number }) => {
      position.set(x, y, z);
    },
    setNextKinematicRotation: ({
      x,
      y,
      z,
      w,
    }: {
      x: number;
      y: number;
      z: number;
      w: number;
    }) => {
      rotation.set(x, y, z, w);
    },
    translation: () => ({ x: position.x, y: position.y, z: position.z }),
    rotation: () => ({ x: rotation.x, y: rotation.y, z: rotation.z, w: rotation.w }),
    linvel: () => ({ x: vel.x, y: vel.y, z: vel.z }),
  };
}
