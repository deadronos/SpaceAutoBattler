import { describe, it, expect } from 'vitest';
import { Quaternion, Vector3 } from 'three';
import { applyProgressionDefaults } from './helpers/progression.js';
import { createDefaultMotionStats } from '../../src/game/ships.js';
import type { GameEntity, GameState, ShipEntity } from '../../src/types/index.js';
import { fireProjectile, updateGame } from '../../src/game/systems.js';
import { flushPostPhysicsMutations } from '../../src/game/simulationQueue.js';

function makeRigidBodyStub(init?: {
  pos?: { x: number; y: number; z: number };
  rot?: { x: number; y: number; z: number; w: number };
}) {
  let pos = init?.pos ?? { x: 0, y: 0, z: 0 };
  let rot = init?.rot ?? { x: 0, y: 0, z: 0, w: 1 };
  return {
    translation() {
      return pos;
    },
    rotation() {
      return rot;
    },
    setNextKinematicTranslation(p: { x: number; y: number; z: number }) {
      pos = { ...p };
    },
    setNextKinematicRotation(r: { x: number; y: number; z: number; w: number }) {
      rot = { ...r };
    },
    isValid() {
      return true;
    },
  } as any;
}

function makeStateStub(): GameState {
  const entities: GameEntity[] = [] as any;
  const queries = {
    ships: { entities: [] as any[] },
    projectiles: { entities: [] as any[] },
    turrets: { entities: [] as any[] },
  } as any;
  const shipById = new Map<number, ShipEntity>();
  const world = {
    entities,
    createEntity(obj: any) {
      entities.push(obj);
      // keep queries lists roughly in sync for systems to iterate
      if (obj.projectile) (queries.projectiles.entities as any[]).push(obj);
      if (obj.ship) {
        (queries.ships.entities as any[]).push(obj);
        shipById.set(obj.id, obj);
      }
      if (obj.turret) (queries.turrets.entities as any[]).push(obj);
      return obj;
    },
    add(obj: any) {
      entities.push(obj);
      if (obj.projectile) (queries.projectiles.entities as any[]).push(obj);
      if (obj.ship) {
        (queries.ships.entities as any[]).push(obj);
        shipById.set(obj.id, obj);
      }
      if (obj.turret) (queries.turrets.entities as any[]).push(obj);
      return obj;
    },
    destroyEntity(obj: any) {
      const i = entities.indexOf(obj);
      if (i >= 0) entities.splice(i, 1);
      if (obj.ship) shipById.delete(obj.id);
    },
    remove(obj: any) {
      const i = entities.indexOf(obj);
      if (i >= 0) entities.splice(i, 1);
      if (obj.ship) shipById.delete(obj.id);
    },
  } as any;

  const rapierStub = {
    RigidBodyDesc: {
      kinematicPositionBased: () => ({
        _pos: { x: 0, y: 0, z: 0 },
        _rot: { x: 0, y: 0, z: 0, w: 1 },
        setTranslation(x: number, y: number, z: number) {
          this._pos = { x, y, z };
          return this;
        },
        setRotation(r: { x: number; y: number; z: number; w: number }) {
          this._rot = r;
          return this;
        },
      }),
    },
    ColliderDesc: {
      ball: () => ({
        setActiveEvents() {
          return this;
        },
        setActiveCollisionTypes() {
          return this;
        },
      }),
    },
    ActiveEvents: { COLLISION_EVENTS: 1 },
    ActiveCollisionTypes: { ALL: 1 },
  } as any;

  let nextHandle = 1;
  const physicsWorld = {
    createRigidBody: (desc?: any) =>
      makeRigidBodyStub(desc ? { pos: desc._pos, rot: desc._rot } : undefined),
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
    shipById,
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
  } as GameState;
}

function makeShip(
  id: number,
  team: 'blue' | 'red',
  position: Vector3,
  hp = 10,
  shield = 5,
): ShipEntity {
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
      maxShield: shield,
      cooldown: 0,
      fireRate: 1,
      damage: 3,
      projectileSpeed: 20,
      range: 15,
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

describe('projectile resolution', () => {
  it('applies shield then hull damage and emits ripple', () => {
    const state = makeStateStub();
    const attacker = makeShip(1, 'blue', new Vector3(0, 0, 0));
    const target = makeShip(2, 'red', new Vector3(0, 0, 0.5), 10, 4); // inside impact radius
    (state.queries.ships as any).entities = [attacker, target];
    state.shipById.set(attacker.id, attacker);
    state.shipById.set(target.id, target);
    // Prevent auto-fire from prepareShips for both sides
    attacker.ship.cooldown = 999;
    target.ship.cooldown = 999;

    // Fire a projectile that will immediately overlap target in resolve step
    const dir = new Vector3(0, 0, 1);
    const originNearTarget = target.transform.position.clone().addScaledVector(dir, -0.05);
    fireProjectile(state, attacker, dir, { originPosition: originNearTarget });
    expect(state.simulation.postStepMutations).toHaveLength(1);
    flushPostPhysicsMutations(state);
    expect((state.queries.projectiles as any).entities.length).toBe(1);

    // Step small delta to resolve collision
    updateGame(state, 0.016);

    // Projectile should be removed
    expect((state.queries.projectiles as any).entities.length).toBe(0);
    // Shield should be reduced first (kinetic damage effectiveness 0.8 -> shield from 4 to 1.6)
    expect(target.ship.shield).toBeCloseTo(1.6, 5);
    expect(target.ship.hp).toBe(10);
    // Ripple should be emitted
    expect(target.shieldRipples && target.shieldRipples.length).toBeGreaterThan(0);
  });

  it('kills ship when hull <= 0 and removes entity', () => {
    const state = makeStateStub();
    const attacker = makeShip(1, 'blue', new Vector3(0, 0, 0));
    const target = makeShip(2, 'red', new Vector3(0, 0, 0.3), 2, 0);
    (state.queries.ships as any).entities = [attacker, target];
    state.shipById.set(attacker.id, attacker);
    state.shipById.set(target.id, target);
    attacker.ship.cooldown = 999;
    target.ship.cooldown = 999;

    // Increase attacker damage to 5 to ensure kill
    attacker.ship.damage = 5;
    const dir = new Vector3(0, 0, 1);
    const originNearTarget = target.transform.position.clone().addScaledVector(dir, -0.05);
    fireProjectile(state, attacker, dir, { originPosition: originNearTarget });
    expect(state.simulation.postStepMutations).toHaveLength(1);
    flushPostPhysicsMutations(state);
    expect((state.queries.projectiles as any).entities.length).toBe(1);

    updateGame(state, 0.016);

    // Target should be removed by resolve loop
    const ships = (state.queries.ships as any).entities as ShipEntity[];
    expect(ships.find((s) => s.id === target.id)).toBeUndefined();
    expect(state.explosions.length).toBe(1);
    expect(state.explosions[0]?.faction).toBe('reavers');
  });

  it('removes projectile when ttl expires', () => {
    const state = makeStateStub();
    const attacker = makeShip(1, 'blue', new Vector3(0, 0, 0));
    const farEnemy = makeShip(2, 'red', new Vector3(1000, 0, 0));
    (state.queries.ships as any).entities = [attacker, farEnemy];
    state.shipById.set(attacker.id, attacker);
    state.shipById.set(farEnemy.id, farEnemy);
    attacker.ship.cooldown = 999;
    farEnemy.ship.cooldown = 999;

    // Make very slow projectile with very short range so ttl small
    attacker.ship.projectileSpeed = 1;
    attacker.ship.range = 1; // lifetime = 1/1 = 1s
    fireProjectile(state, attacker, new Vector3(1, 0, 0));
    expect(state.simulation.postStepMutations).toHaveLength(1);
    flushPostPhysicsMutations(state);
    expect((state.queries.projectiles as any).entities.length).toBe(1);

    // Advance time beyond ttl
    updateGame(state, 1.2);
    expect((state.queries.projectiles as any).entities.length).toBe(0);
  });
});
