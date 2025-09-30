import { Vector3 } from 'three';
import type { GameState, ShipEntity } from '../../types/index.js';
import type { SeededRng } from '../../utils/rng.js';
import { AI_CONFIG } from '../config.js';
import { createDefaultMetrics } from '../metrics.js';
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
  } as unknown as HarnessGameState;

  return state;
}
