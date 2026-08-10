import { World as ECSWorld } from 'miniplex';
import { Vector3 } from 'three';
import Rapier from '@dimforge/rapier3d-compat';
import type { GameEntity, GameState } from '../types/index.js';
import { SeededRng } from '../utils/rng.js';
import { createDefaultMetrics } from './metrics.js';
import { AI_CONFIG } from './config.js';
import { createDefaultDoctrineState } from './aiDoctrine.js';

interface CreateGameStateOptions {
  renderOnly?: boolean;
}

export const DEFAULT_GAME_SEED = 1337;

/**
 * Initializes the game state, including physics (Rapier), ECS world, and AI state.
 *
 * @returns {Promise<GameState>} A promise that resolves to the initialized GameState.
 */
export async function createGameState(options: CreateGameStateOptions = {}): Promise<GameState> {
  const renderOnly = options.renderOnly === true;
  let physicsWorld: GameState['physicsWorld'];
  let eventQueue: GameState['eventQueue'];
  let rapierModule: GameState['rapier'];
  if (renderOnly) {
    physicsWorld = {
      integrationParameters: {
        dt: 1 / 20,
      },
      free: () => {},
      removeCollider: () => {},
      removeRigidBody: () => {},
    } as unknown as GameState['physicsWorld'];
    eventQueue = {
      free: () => {},
    } as unknown as GameState['eventQueue'];
    rapierModule = {} as GameState['rapier'];
  } else {
    await Rapier.init();
    physicsWorld = new Rapier.World({ x: 0, y: 0, z: 0 });
    eventQueue = new Rapier.EventQueue(true);
    rapierModule = Rapier;
  }

  const world = new ECSWorld<GameEntity>();

  const state: GameState = {
    rapier: rapierModule,
    physicsWorld,
    eventQueue,
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
    rng: new SeededRng(DEFAULT_GAME_SEED),
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
      enabled: AI_CONFIG.v2Enabled,
      tickInterval: 1 / AI_CONFIG.tickRateHz,
      maxPerTick: AI_CONFIG.maxPerTick,
      accumulator: 0,
      tickIndex: 0,
      cursor: 0,
      slices: AI_CONFIG.slices,
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
  };

  return state;
}
