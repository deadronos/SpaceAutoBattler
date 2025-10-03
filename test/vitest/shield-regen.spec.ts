import { describe, it, expect } from 'vitest';
import { Vector3, Quaternion } from 'three';
import { applyProgressionDefaults } from './helpers/progression.js';
import { createDefaultMotionStats } from '../../src/game/ships.js';
import type { GameState, ShipEntity } from '../../src/types/index.js';
import { updateGame } from '../../src/game/systems.js';

function makeRigidBodyStub(init?: { pos?: { x: number; y: number; z: number }; rot?: { x: number; y: number; z: number; w: number } }) {
  let pos = init?.pos ?? { x: 0, y: 0, z: 0 };
  let rot = init?.rot ?? { x: 0, y: 0, z: 0, w: 1 };
  return {
    translation() { return pos; },
    rotation() { return rot; },
    setNextKinematicTranslation(p: { x: number; y: number; z: number }) { pos = { ...p }; },
    setNextKinematicRotation(r: { x: number; y: number; z: number; w: number }) { rot = { ...r }; },
    isValid() { return true; },
  } as any;
}

function makeStateStub(): GameState {
  const entities: any[] = [];
  const queries = { ships: { entities: [] as any[] }, projectiles: { entities: [] as any[] }, turrets: { entities: [] as any[] } } as any;
  const world = {
    entities,
    createEntity(obj: any) {
      entities.push(obj);
      if (obj.projectile) (queries.projectiles.entities as any[]).push(obj);
      if (obj.ship) (queries.ships.entities as any[]).push(obj);
      if (obj.turret) (queries.turrets.entities as any[]).push(obj);
      return obj;
    },
    add(obj: any) {
      entities.push(obj);
      if (obj.projectile) (queries.projectiles.entities as any[]).push(obj);
      if (obj.ship) (queries.ships.entities as any[]).push(obj);
      if (obj.turret) (queries.turrets.entities as any[]).push(obj);
      return obj;
    },
    destroyEntity(obj: any) {
      const i = entities.indexOf(obj);
      if (i >= 0) entities.splice(i, 1);
    },
    remove(obj: any) {
      const i = entities.indexOf(obj);
      if (i >= 0) entities.splice(i, 1);
    },
  } as any;

  const rapierStub = {
    RigidBodyDesc: { kinematicPositionBased: () => ({ _pos: { x: 0, y: 0, z: 0 }, _rot: { x: 0, y: 0, z: 0, w: 1 }, setTranslation(x: number, y: number, z: number) { this._pos = { x, y, z }; return this; }, setRotation(r: { x: number; y: number; z: number; w: number }) { this._rot = r; return this; } }) },
    ColliderDesc: { ball: () => ({ setActiveEvents() { return this; }, setActiveCollisionTypes() { return this; } }) },
    ActiveEvents: { COLLISION_EVENTS: 1 },
    ActiveCollisionTypes: { ALL: 1 },
  } as any;

  let nextHandle = 1;
  const physicsWorld = {
    createRigidBody: (desc?: any) => makeRigidBodyStub(desc ? { pos: desc._pos, rot: desc._rot } : undefined),
    createCollider: () => ({ handle: nextHandle++, isValid: () => true }) as any,
    removeCollider() {},
    removeRigidBody() {},
    step() {},
  } as any;

  return {
    rapier: rapierStub,
    physicsWorld,
    eventQueue: {} as any,
    world: world as any,
    colliderLookup: new Map(),
    nextEntityId: 1,
    nextExplosionId: 1,
    time: 0,
    queries,
    rng: { next: () => 0.5 } as any,
    paused: false,
    timeScale: 1,
    explosions: [],
    explosionPool: [],
    progressionEvents: new Map(),
    uiFlags: { hudHealthBars: false },
    ai: undefined as any,
    blackboard: {
      tickIndex: 0,
      teamPosture: { blue: 'hold', red: 'hold' },
      allyCentroid: { blue: new Vector3(), red: new Vector3() },
      nearestEnemy: new Map(),
      threatToVip: new Map(),
      tmpVectors: [new Vector3(), new Vector3(), new Vector3(), new Vector3()],
    } as any,
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
    },
  } as GameState;
}

function makeShip(id: number, team: 'blue'|'red', position: Vector3, hp=10, shield=10, maxShield=20, regen=0): ShipEntity {
  const rb = makeRigidBodyStub({ pos: { x: position.x, y: position.y, z: position.z } });
  const shipEntity = {
    id,
    rigidBody: rb as any,
    collider: { handle: 1000 + id, isValid: () => true } as any,
    transform: { position: position.clone(), rotation: new Quaternion(), scale: 1 },
    ship: {
      team,
      hull: 'fighter' as any,
      hp,
      maxHp: hp,
      shield,
      maxShield,
      shieldRegen: regen,
      cooldown: 999, // prevent auto-firing during these tests
      fireRate: 1,
      damage: 1,
      projectileSpeed: 10,
      range: 10,
      speed: 0,
      bulletType: 'bullet:laser',
      velocity: new Vector3(0, 0, 0),
      angularVelocity: new Vector3(0, 0, 0),
      lateralAcceleration: 0,
      motion: createDefaultMotionStats(),
    },
    model: 'fighter' as any,
    shieldRipples: [],
  } as unknown as ShipEntity;

  applyProgressionDefaults(shipEntity.ship, { maxHpOverride: shipEntity.ship.maxHp });
  return shipEntity;
}

describe('shield regeneration', () => {
  it('regenerates shield over time according to shieldRegen (hp/sec)', () => {
    const state = makeStateStub();
    const s = makeShip(1, 'blue', new Vector3(0,0,0), 10, 10, 20, 2); // regen 2 hp/s
    (state.queries.ships as any).entities = [s];

    // Advance 1.5 seconds -> expect +3 hp
    updateGame(state, 1.5);
    expect(s.ship.shield).toBeCloseTo(13, 6);
  });

  it('does not exceed maxShield (clamps)', () => {
    const state = makeStateStub();
    // start at 19/20 with regen 5 hp/s, advance 1s -> would reach 24 but should clamp to 20
    const s = makeShip(2, 'red', new Vector3(0,0,0), 10, 19, 20, 5);
    (state.queries.ships as any).entities = [s];

    updateGame(state, 1.0);
    expect(s.ship.shield).toBe(20);
  });
});

