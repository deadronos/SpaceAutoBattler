import { describe, it, expect } from 'vitest';
import { Quaternion, Vector3 } from 'three';
import { applyProgressionDefaults } from './helpers/progression.js';
import { createDefaultMotionStats } from '../../src/game/ships.js';
import { updateGame } from '../../src/game/systems.js';
import type { GameState, ShipEntity, TurretState } from '../../src/types/index.js';

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
  const entities: any[] = [];
  const world = {
    entities,
    createEntity(obj: any) {
      entities.push(obj);
      return obj;
    },
    add(obj: any) {
      entities.push(obj);
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
    RigidBodyDesc: {
      kinematicPositionBased: () => {
        const d: any = { _pos: { x: 0, y: 0, z: 0 }, _rot: { x: 0, y: 0, z: 0, w: 1 } };
        d.setTranslation = function (x: number, y: number, z: number) {
          this._pos = { x, y, z };
          return this;
        };
        d.setRotation = function (r: { x: number; y: number; z: number; w: number }) {
          this._rot = r;
          return this;
        };
        return d;
      },
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
      capsule: () => ({
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
    createCollider: () => ({ handle: nextHandle++, isValid: () => true }),
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
    queries: {
      ships: { entities: [] },
      projectiles: { entities: [] },
      turrets: { entities: [] },
    } as any,
    rng: { next: () => 0.5 } as any,
    paused: false,
    timeScale: 1,
    explosions: [],
    explosionPool: [],
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
    },
  } as GameState;
}

function makeShipWithTurret(
  team: 'red' | 'blue',
  pos: Vector3,
  turret: Omit<TurretState, 'cooldown'> & { cooldown?: number },
): ShipEntity {
  const rb = makeRigidBodyStub();
  const ship = {
    id: Math.floor(Math.random() * 10000),
    rigidBody: rb as any,
    collider: { handle: Math.floor(Math.random() * 10000), isValid: () => true } as any,
    transform: {
      position: pos.clone(),
      rotation: new Quaternion(),
      scale: 1,
    },
    ship: {
      team,
      hull: 'corvette' as any,
      hp: 100,
      maxHp: 100,
      shield: 0,
      maxShield: 0,
      cooldown: 999, // disable main cannon for clarity
      fireRate: 1,
      damage: 10,
      projectileSpeed: 10,
      range: 10,
      speed: 0,
      bulletType: 'bullet:heavy', // different from turret to verify override
      velocity: new Vector3(0, 0, 0),
      angularVelocity: new Vector3(0, 0, 0),
      lateralAcceleration: 0,
      motion: createDefaultMotionStats(),
    },
    model: 'corvette' as any,
    shieldRipples: [],
    turrets: [
      {
        offset: turret.offset.clone(),
        damage: turret.damage,
        fireRate: turret.fireRate,
        projectileSpeed: turret.projectileSpeed,
        range: turret.range,
        bulletType: turret.bulletType,
        cooldown: turret.cooldown ?? 0,
      },
    ],
  } as unknown as ShipEntity;

  applyProgressionDefaults(ship.ship, { hull: 'corvette', maxHpOverride: ship.ship.maxHp });
  return ship;
}

describe('Turret system', () => {
  it('fires turret with its own stats and origin', () => {
    const state = makeStateStub();

    const friendly = makeShipWithTurret('blue', new Vector3(0, 0, 0), {
      offset: new Vector3(1, 0, 0),
      damage: 7,
      fireRate: 1.0,
      projectileSpeed: 24,
      range: 12,
      bulletType: 'bullet:laser',
    });

    const enemy = makeRigidBodyStub();
    const enemyShip = {
      id: 999,
      rigidBody: enemy as any,
      collider: { handle: 9999, isValid: () => true } as any,
      transform: { position: new Vector3(5, 0, 0), rotation: new Quaternion(), scale: 1 },
      ship: {
        team: 'red',
        hull: 'fighter' as any,
        hp: 10,
        maxHp: 10,
        shield: 0,
        maxShield: 0,
        cooldown: 999,
        fireRate: 1,
        damage: 2,
        projectileSpeed: 10,
        range: 10,
        speed: 0,
        bulletType: 'bullet:ion',
        velocity: new Vector3(0, 0, 0),
        angularVelocity: new Vector3(0, 0, 0),
        lateralAcceleration: 0,
        motion: createDefaultMotionStats(),
      },
      model: 'fighter' as any,
      shieldRipples: [],
    } as unknown as ShipEntity;

    applyProgressionDefaults(enemyShip.ship, { maxHpOverride: enemyShip.ship.maxHp });

    // Register ships in state queries so systems can iterate
    (state.queries.ships as any).entities = [friendly, enemyShip];

    // Advance a small step to trigger turret fire
    updateGame(state, 0.016);

    // One projectile should be spawned by turret
    const spawned = (state.world.entities as any[]).filter((e: any) => e.projectile);
    expect(spawned.length).toBe(1);
    const p: any = spawned[0];

    // Projectile should reflect turret overrides, not main cannon
    expect(p.projectile.damage).toBe(7);
    expect(p.projectile.speed).toBe(24);
    expect(p.projectile.bulletType).toBe('bullet:laser');

    // Origin should match rotated turret mount world position relative to ship at origin
    const expectedWorld = new Vector3(1, 0, 0)
      .applyQuaternion(friendly.transform.rotation)
      .add(friendly.transform.position);
    // Projectile moves slightly during the frame; ensure it started near the mount (within small epsilon + movement)
    const moved = p.transform.position.clone().sub(expectedWorld);
    // Movement should be along direction; but at least ensure it is close to 0..0.5 units depending on speed*dt
    expect(moved.length()).toBeLessThan(0.5);
  });
});

