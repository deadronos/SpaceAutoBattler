import { describe, expect, it, vi } from 'vite-plus/test';
import { Quaternion, Vector3 } from 'three';
import { applyProgressionDefaults } from './helpers/progression.js';
import { createDefaultMotionStats } from '../../src/game/ships.js';
import { __aiTestHooks } from '../../src/game/systems.js';
import {
  flushDeferredMutations,
  flushPostPhysicsMutations,
} from '../../src/game/simulationQueue.js';
import { createDefaultMetrics } from '../../src/game/metrics.js';
import type { GameState, ShipEntity } from '../../src/types/index.js';
import { updateMotionSystem } from '../../src/game/systems/motion.js';

const { prepareShips, executeAICommand } = __aiTestHooks;

function createRigidBodyRecorder() {
  let last = { x: 0, y: 0, z: 0 };
  let lastRotation = { x: 0, y: 0, z: 0, w: 1 };
  return {
    body: {
      setNextKinematicTranslation: (next: { x: number; y: number; z: number }) => {
        last = { ...next };
      },
      setNextKinematicRotation: (rotation: { x: number; y: number; z: number; w: number }) => {
        lastRotation = { ...rotation };
      },
      translation: () => last,
      rotation: () => lastRotation,
    },
    read: () => last,
  };
}

function createState(): GameState {
  return {
    ai: {
      enabled: false,
      tickInterval: 0.1,
      maxPerTick: 10,
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
    timeScale: 1,
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
  } as unknown as GameState;
}

function createShip(id: number, team: 'blue' | 'red', position: Vector3) {
  const recorder = createRigidBodyRecorder();
  const ship = {
    id,
    rigidBody: recorder.body as never,
    collider: {} as never,
    transform: {
      position: position.clone(),
      rotation: new Quaternion(),
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
      cooldown: 1,
      fireRate: 1,
      damage: 6,
      projectileSpeed: 30,
      range: 180,
      speed: 30,
      bulletType: 'bullet:laser',
      velocity: new Vector3(0, 0, 0),
      angularVelocity: new Vector3(0, 0, 0),
      lateralAcceleration: 0,
      motion: createDefaultMotionStats(),
    },
    model: 'fighter',
    ai: {
      profileId: 'brawler',
      intent: 'Attack',
      nextThinkAt: 0,
      cooldowns: { dodgeAt: 0, burstAt: 0 },
      lod: 0,
      traitSeed: 42,
      traits: { aggression: 1, patience: 1, dodge: 1 },
      stickinessUntil: 0,
      stickinessHeading: new Vector3(0, 0, 1),
      command: {
        heading: new Vector3(0, 0, 1),
        thrust: 0,
        firePrimary: false,
        ttl: 0.1,
      },
    },
  } as unknown as ShipEntity;

  applyProgressionDefaults(ship.ship, { maxHpOverride: ship.ship.maxHp });
  return { ship, recorder };
}

describe('AI v2 enforcement', () => {
  it('forces AI enabled and still executes commands when the state flag is false', () => {
    const state = createState();
    state.ai.enabled = false;

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const { ship: blue, recorder } = createShip(1, 'blue', new Vector3(0, 0, 0));
    blue.ai!.command.thrust = 1;
    blue.ai!.command.ttl = 1;
    blue.ai!.command.heading.set(0, 0, 1);

    const { ship: red } = createShip(2, 'red', new Vector3(150, 0, 0));
    red.ai!.command.heading.set(0, 0, -1);

    const ships = state.queries.ships.entities as unknown as ShipEntity[];
    ships.splice(0, ships.length, blue, red);

    prepareShips(state, 0.1);

    // Movement is now handled by the motion system, not prepareShips
    updateMotionSystem(state, 0.1);

    flushDeferredMutations(state);
    flushPostPhysicsMutations(state);

    expect(state.ai.enabled).toBe(true);

    // Motion system uses acceleration/velocity integration, so movement is gradual.
    // The key assertion is that the ship moved forward (positive Z).
    const position = recorder.read();
    expect(position.x).toBe(0);
    expect(position.y).toBe(0);
    expect(position.z).toBeGreaterThan(0); // Ship moved forward

    expect(warnSpy).toHaveBeenCalled();

    warnSpy.mockRestore();
  });
});

describe('Missing AI safeguards', () => {
  it('logs an error and keeps the ship stationary when AI is missing', () => {
    const state = createState();
    const { ship, recorder } = createShip(5, 'blue', new Vector3(12, 0, -4));
    delete (ship as { ai?: unknown }).ai;

    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const result = executeAICommand(state, ship, 0.1);

    flushDeferredMutations(state);
    flushPostPhysicsMutations(state);

    expect(result).toBeNull();
    expect(recorder.read()).toEqual({ x: 12, y: 0, z: -4 });
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining('Ship 5 is missing an AI component'),
    );

    errorSpy.mockRestore();
  });
});
