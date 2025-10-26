import { Vector3 } from 'three';
import type { GameState, ShipEntity } from '../../../src/types/index.js';
import type { SeededRng } from '../../../src/utils/rng.js';
import { AI_CONFIG } from '../../../src/game/config.js';
import { createDefaultMetrics } from '../../../src/game/metrics.js';
import type { HarnessGameState, HarnessQueries, HarnessShip } from './types.js';
import { createPhysicsWorldShim, createRapierShim } from './rapierShim.js';

/**
 * Creates a harness game state with all necessary queries and environment wiring.
 * Construction of harness game state and queries.
 */
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

  const physicsWorld = createPhysicsWorldShim();
  const rapier = createRapierShim();

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
    simulation: {
      step: tickInterval,
      accumulator: 0,
      maxSubSteps: 5,
      alpha: 0,
      lastTickIndex: 0,
      lastTickStart: 0,
      lastTickDuration: tickInterval,
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
  } as unknown as HarnessGameState;

  return state;
}
