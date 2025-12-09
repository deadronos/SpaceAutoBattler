import { describe, it, expect } from 'vitest';
import { Quaternion, Vector3 } from 'three';
import { applyProgressionDefaults } from './helpers/progression.js';
import { createDefaultMotionStats } from '../../src/game/ships.js';
import type { GameEntity, GameState, ShipEntity, ProjectileEntity } from '../../src/types/index.js';
import { fireProjectile } from '../../src/game/systems.js';
import { flushPostPhysicsMutations } from '../../src/game/simulationQueue.js';
import { resolveProjectiles } from '../../src/game/systems/damage.js';

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

describe('Flak Proximity Fuse', () => {
  it('detonates when near enemy ship', () => {
    const state = makeStateStub();
    const attacker = makeShip(1, 'blue', new Vector3(0, 0, 0));
    // Target is 2 units away on Y axis. Flak proximity radius is 4.
    const target = makeShip(2, 'red', new Vector3(10, 2, 0), 100, 0);
    (state.queries.ships as any).entities = [attacker, target];
    state.shipById.set(attacker.id, attacker);
    state.shipById.set(target.id, target);

    // Fire flak along X axis
    // Use override to set flak type
    fireProjectile(state, attacker, new Vector3(1, 0, 0), {
        override: {
            bulletType: 'bullet:flak',
            originPosition: new Vector3(0, 0, 0)
        }
    });

    flushPostPhysicsMutations(state);
    const projectile = (state.queries.projectiles as any).entities[0] as ProjectileEntity;
    expect(projectile).toBeDefined();
    expect(projectile.projectile.proximityFuse).toBeDefined();

    // Manually move projectile to x=10 (closest approach to target at 10,2,0 is distance 2)
    projectile.transform.position.set(10, 0, 0);

    // Run resolution
    resolveProjectiles(state, 0.016);

    // Projectile should be gone
    expect((state.queries.projectiles as any).entities.length).toBe(0);

    // Target should be damaged
    expect(target.ship.hp).toBeLessThan(100);
  });

  it('does not detonate when far from enemy ship', () => {
    const state = makeStateStub();
    const attacker = makeShip(1, 'blue', new Vector3(0, 0, 0));
    // Target is 10 units away on Y axis. Flak proximity radius is 4.
    const target = makeShip(2, 'red', new Vector3(10, 10, 0), 100, 0);
    (state.queries.ships as any).entities = [attacker, target];
    state.shipById.set(attacker.id, attacker);
    state.shipById.set(target.id, target);

    fireProjectile(state, attacker, new Vector3(1, 0, 0), {
        override: {
            bulletType: 'bullet:flak',
            originPosition: new Vector3(0, 0, 0)
        }
    });

    flushPostPhysicsMutations(state);
    const projectile = (state.queries.projectiles as any).entities[0] as ProjectileEntity;

    projectile.transform.position.set(10, 0, 0);

    resolveProjectiles(state, 0.016);

    // Projectile should still exist
    expect((state.queries.projectiles as any).entities.length).toBe(1);

    // Target should not be damaged
    expect(target.ship.hp).toBe(100);
  });

  it('does not detonate when near friendly ship', () => {
    const state = makeStateStub();
    const attacker = makeShip(1, 'blue', new Vector3(0, 0, 0));
    const friend = makeShip(2, 'blue', new Vector3(10, 2, 0), 100, 0);
    (state.queries.ships as any).entities = [attacker, friend];
    state.shipById.set(attacker.id, attacker);
    state.shipById.set(friend.id, friend);

    fireProjectile(state, attacker, new Vector3(1, 0, 0), {
        override: {
            bulletType: 'bullet:flak',
            originPosition: new Vector3(0, 0, 0)
        }
    });

    flushPostPhysicsMutations(state);
    const projectile = (state.queries.projectiles as any).entities[0] as ProjectileEntity;

    projectile.transform.position.set(10, 0, 0);

    resolveProjectiles(state, 0.016);

    // Projectile should still exist
    expect((state.queries.projectiles as any).entities.length).toBe(1);

    // Friend should not be damaged
    expect(friend.ship.hp).toBe(100);
  });
});
