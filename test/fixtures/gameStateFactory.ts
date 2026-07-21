import { World as ECSWorld } from 'miniplex';
import { Vector3, Quaternion } from 'three';
import type { GameEntity, GameState } from '../../src/types/index.js';
import { SeededRng } from '../../src/utils/rng.js';
import { createDefaultMetrics } from '../../src/game/metrics.js';
import { createDefaultDoctrineState } from '../../src/game/aiDoctrine.js';
import { createDefaultMotionStats } from '../../src/game/ships.js';
import { createProgressionDefaults, createSubsystems } from '../../src/game/progression.js';

export const TEST_GAME_SEED = 42;

/**
 * Creates a lightweight, synchronous mock GameState suitable for unit testing
 * without needing asynchronous physics WASM initialization.
 */
export function createMockGameState(overrides: Partial<GameState> = {}): GameState {
  const world = new ECSWorld<GameEntity>();

  const baseState: GameState = {
    rapier: {} as GameState['rapier'],
    physicsWorld: {
      integrationParameters: { dt: 1 / 20 },
      free: () => {},
      removeCollider: () => {},
      removeRigidBody: () => {},
      step: () => {},
    } as GameState['physicsWorld'],
    eventQueue: {
      free: () => {},
    } as GameState['eventQueue'],
    world,
    colliderLookup: new Map(),
    shipById: new Map(),
    turretsByShip: new Map(),
    nextEntityId: 1,
    nextExplosionId: 1,
    time: 0,
    queries: {
      ships: world.with('ship'),
      shipsWithCommands: world.with('ship', 'ai'),
      projectiles: world.with('projectile'),
      turrets: world.with('turret'),
    },
    rng: new SeededRng(TEST_GAME_SEED),
    paused: false,
    timeScale: 1,
    uiFlags: {
      hudHealthBars: false,
    },
    explosions: [],
    explosionPool: [],
    progressionEvents: new Map(),
    simulation: {
      step: 1 / 20,
      accumulator: 0,
      maxSubSteps: 5,
      profileSubsystems: false,
      profileSampleRate: 1,
      enableSubsystemGuards: true,
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
        stepPanics: 0,
        lastStepPanicTick: -1,
        lastStepPanicTime: 0,
        lastStepPanicDelta: 0,
        lastStepPanicMessage: undefined,
        lastStepPanicStack: undefined,
        lastStepPanicTimestamp: 0,
        subsystemFailures: 0,
        lastSubsystemFailureTick: -1,
        lastSubsystemFailureMessage: undefined,
        lastSubsystemFailureStack: undefined,
        lastSubsystemFailureTimestamp: 0,
      },
      subsystemTimings: {
        durations: {},
        lastTickIndex: -1,
        lastTickTime: 0,
      },
    },
    ai: {
      enabled: true,
      tickInterval: 0.1,
      maxPerTick: 10,
      accumulator: 0,
      tickIndex: 0,
      cursor: 0,
      slices: 1,
      assignments: {
        escorts: new Map(),
      },
      metrics: createDefaultMetrics(),
      doctrine: createDefaultDoctrineState(),
      interrupts: [],
      interruptState: {
        cooldownTick: new Map(),
        damageThisTick: new Map(),
        lastDamageTick: -1,
        vipThreatAssignments: new Map(),
      },
    },
    sensors: {
      lastUpdateTick: -1,
      visibilityByTeam: {
        blue: new Map(),
        red: new Map(),
      },
      decayRate: 0.65,
      threshold: 0.18,
      staleDecay: 0.55,
    },
    blackboard: {
      tickIndex: 0,
      teamPosture: {
        blue: 'hold',
        red: 'hold',
      },
      allyCentroid: {
        blue: new Vector3(),
        red: new Vector3(),
      },
      nearestEnemy: new Map(),
      threatToVip: new Map(),
      tmpVectors: [new Vector3(), new Vector3(), new Vector3(), new Vector3()],
      strengthRatio: {
        blue: 1,
        red: 1,
      },
      teamPriority: {
        blue: [],
        red: [],
      },
      priorityIndex: {
        blue: new Map(),
        red: new Map(),
      },
      focusFire: {
        blue: new Map(),
        red: new Map(),
      },
      visibleEnemies: {
        blue: new Map(),
        red: new Map(),
      },
      teamCounts: {
        blue: 0,
        red: 0,
      },
      verticalDispersion: {
        headingYSamples: [],
        positionYSamples: [],
        lastUpdateTick: -1,
      },
    },
    ...overrides,
  };

  return baseState;
}

/**
 * Creates a mock ship entity for unit tests.
 */
export function createMockShipEntity(
  id: number,
  team: 'blue' | 'red' = 'blue',
  position = new Vector3(0, 0, 0),
  hp = 100,
  maxHp = 100,
): GameEntity {
  const rotation = new Quaternion();
  const prog = createProgressionDefaults('frigate');
  return {
    id,
    rigidBody: {
      translation: () => ({ x: position.x, y: position.y, z: position.z }),
      rotation: () => ({ x: rotation.x, y: rotation.y, z: rotation.z, w: rotation.w }),
      setNextKinematicTranslation: () => {},
      setNextKinematicRotation: () => {},
      linvel: () => ({ x: 0, y: 0, z: 0 }),
      isValid: () => true,
    } as any,
    collider: { handle: id, isValid: () => true } as any,
    transform: {
      position,
      rotation,
      scale: 1,
    },
    ship: {
      team,
      hull: 'frigate',
      hp,
      maxHp,
      shield: 50,
      maxShield: 50,
      shieldRegen: 5,
      cooldown: 0,
      fireRate: 1,
      damage: 10,
      projectileSpeed: 50,
      range: 200,
      speed: 20,
      bulletType: 'bullet:laser',
      velocity: new Vector3(0, 0, 0),
      angularVelocity: new Vector3(0, 0, 0),
      lateralAcceleration: 0,
      motion: createDefaultMotionStats(),
      sensor: { detectionRange: 300, trackingRange: 350, coneAngle: Math.PI * 2, falloff: 0.5 },
      xp: prog.xp,
      level: prog.level,
      xpToNext: prog.xpToNext,
      damageType: prog.damageType,
      levelBonuses: prog.levelBonuses,
      subsystems: createSubsystems(maxHp),
      armor: prog.armor,
    },
  };
}
