import { Vector3 } from 'three';
import type { GameState, AIBlackboard, AIState, ShipEntity } from '../../../src/types/index.js';
import { createDefaultMetrics } from '../../../src/game/metrics.js';

/**
 * Create a fully initialized blackboard for tests.
 * Prevents undefined property access errors in test fixtures.
 */
export function createTestBlackboard(): AIBlackboard {
  return {
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
  };
}

/**
 * Create a minimal GameState stub for tests.
 * Uses proper initialization for all nested structures.
 *
 * @param overrides Optional partial overrides for specific state properties
 */
export function createTestGameState(overrides?: Partial<GameState>): GameState {
  const ships: ShipEntity[] = [];

  const baseState: GameState = {
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
    blackboard: createTestBlackboard(),
    queries: {
      ships: { entities: ships },
      projectiles: { entities: [] },
      turrets: { entities: [] },
    },
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
      },
    },
    progressionEvents: new Map(),
  } as unknown as GameState;

  return { ...baseState, ...overrides };
}

/**
 * Create a minimal AIState stub for tests with proper initialization.
 *
 * @param overrides Optional partial overrides for specific AI properties
 */
export function createTestAIState(overrides?: Partial<AIState>): AIState {
  return {
    profileId: 'brawler',
    intent: 'Attack',
    nextThinkAt: 0,
    cooldowns: { dodgeAt: 0, burstAt: 0 },
    lod: 0,
    traitSeed: 1234,
    traits: { aggression: 1, patience: 1, dodge: 1 },
    targetId: undefined,
    command: {
      heading: new Vector3(0, 0, 1),
      thrust: 0,
      firePrimary: false,
      ttl: 0,
    },
    stickinessUntil: 0,
    stickinessTargetId: undefined,
    stickinessHeading: new Vector3(0, 0, 1),
    ...overrides,
  };
}

/**
 * Create a minimal ship entity stub for tests.
 * Includes proper progression defaults and AI state initialization.
 *
 * @param id Entity ID
 * @param team Team assignment
 * @param position World position
 * @param aiOverrides Optional AI state overrides
 */
export function createTestShip(
  id: number,
  team: 'blue' | 'red',
  position: Vector3,
  aiOverrides?: Partial<AIState>,
): ShipEntity {
  return {
    id,
    rigidBody: {
      setNextKinematicTranslation: () => {},
      setNextKinematicRotation: () => {},
    } as never,
    collider: {} as never,
    transform: {
      position: position.clone(),
      rotation: { x: 0, y: 0, z: 0, w: 1 },
      scale: 1,
    },
    ship: {
      team,
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
      xp: 0,
      level: 1,
      xpToNext: 100,
      damageType: 'kinetic',
      levelBonuses: { hp: 0, shield: 0, damage: 0, fireRate: 0, repair: 0, shieldRegen: 0 },
      captain: undefined,
      subsystems: {
        engine: { hp: 18, maxHp: 18, status: 'online', repairRate: 1.8 },
        weapons: { hp: 18, maxHp: 18, status: 'online', repairRate: 1.8 },
        shields: { hp: 18, maxHp: 18, status: 'online', repairRate: 1.8 },
      },
      armor: 0,
      velocity: new Vector3(),
      angularVelocity: new Vector3(),
      lateralAcceleration: 0,
      motion: { desiredHeading: new Vector3(0, 0, 1), speed: 0 },
    },
    model: 'fighter',
    ai: aiOverrides ? createTestAIState(aiOverrides) : createTestAIState(),
  } as unknown as ShipEntity;
}
