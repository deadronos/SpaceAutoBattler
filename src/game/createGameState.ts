import { World as ECSWorld } from 'miniplex';
import { Vector3 } from 'three';
import Rapier from '@dimforge/rapier3d-compat';
import type { GameEntity, GameState } from '../types/index.js';
import { SeededRng } from '../utils/rng.js';
import { createDefaultMetrics } from './metrics.js';
import { AI_CONFIG } from './config.js';
import { createDefaultDoctrineState } from './aiDoctrine.js';

export async function createGameState(): Promise<GameState> {
  // Rapier 0.19+ expects an options object; calling without args triggers a deprecation warning.
  // Passing an empty object keeps default behavior and removes the warning.
  await Rapier.init({});
  const physicsWorld = new Rapier.World({ x: 0, y: 0, z: 0 });
  const eventQueue = new Rapier.EventQueue({ auto: true });
  const world = new ECSWorld<GameEntity>();

  const state: GameState = {
    rapier: Rapier,
    physicsWorld,
    eventQueue,
    world,
    colliderLookup: new Map(),
    turretsByShip: new Map(),
    nextEntityId: 1,
    nextExplosionId: 1,
    time: 0,
    queries: {
      ships: world.with('ship'),
      projectiles: world.with('projectile'),
      turrets: world.with('turret'),
    },
    rng: new SeededRng(1337),
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
