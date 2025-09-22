import { describe, expect, it } from 'vitest';
import { Quaternion, Vector3 } from 'three';
import { createDefaultMotionStats } from '../../src/game/ships.js';
import { __aiTestHooks } from '../../src/game/systems.js';
import type { GameState, ShipEntity } from '../../src/types/index.js';

const { prepareShips, runLegacyShipBehavior } = __aiTestHooks;

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
      metrics: {
        totalDecisions: 0,
        totalSkipped: 0,
        budgetHits: 0,
        lastDecisions: 0,
        lastSkipped: 0,
        lastSliceSize: 0,
        lastTotalShips: 0,
      },
    },
    blackboard: {
      tickIndex: 0,
      teamPosture: { blue: 'hold', red: 'hold' },
      allyCentroid: { blue: new Vector3(), red: new Vector3() },
      nearestEnemy: new Map(),
      threatToVip: new Map(),
      tmpVectors: [],
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
  } as unknown as GameState;
}

function createShip(id: number, team: 'blue' | 'red', position: Vector3) {
  const recorder = createRigidBodyRecorder();
  const ship: ShipEntity = {
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
      angularVelocity: 0,
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
      command: {
        heading: new Vector3(0, 0, 1),
        thrust: 0,
        firePrimary: false,
        ttl: 0.1,
      },
    },
  } as ShipEntity;
  return { ship, recorder };
}

describe('AI flag-off regression', () => {
  it('matches legacy steering when AI V2 is disabled', () => {
    const aiState = createState();
    const legacyState = createState();
    legacyState.ai.enabled = false;

    const { ship: aiBlue, recorder: aiRecorder } = createShip(1, 'blue', new Vector3(0, 0, 0));
    const { ship: aiRed } = createShip(2, 'red', new Vector3(120, 0, 0));
    const { ship: legacyBlue, recorder: legacyRecorder } = createShip(3, 'blue', new Vector3(0, 0, 0));
    const { ship: legacyRed } = createShip(4, 'red', new Vector3(120, 0, 0));

    delete (legacyBlue as { ai?: unknown }).ai;

    const aiShips = aiState.queries.ships.entities as unknown as ShipEntity[];
    aiShips.splice(0, aiShips.length, aiBlue, aiRed);
    const legacyShips = legacyState.queries.ships.entities as unknown as ShipEntity[];
    legacyShips.splice(0, legacyShips.length, legacyBlue, legacyRed);

    prepareShips(aiState, 0.1);
    const aiTranslation = aiRecorder.read();

    runLegacyShipBehavior(legacyState, legacyBlue, 0.1);
    const legacyTranslation = legacyRecorder.read();

    expect(aiTranslation).toEqual(legacyTranslation);
  });
});
