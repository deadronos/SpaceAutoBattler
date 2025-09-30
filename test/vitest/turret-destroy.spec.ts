import { describe, it, expect } from 'vitest';
import { Quaternion, Vector3 } from 'three';
import { createDefaultMotionStats } from '../../src/game/ships.js';
import type { GameState, ShipEntity, TurretEntity } from '../../src/types/index.js';
import { destroyEntity } from '../../src/game/state.js';
import { registerTurret } from '../../src/game/turretRegistry.js';
import { applyProgressionDefaults } from './helpers/progression.js';

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
      kinematicPositionBased: () => ({
        setTranslation() {
          return this;
        },
        setRotation() {
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
    createRigidBody: () => makeRigidBodyStub(),
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
    turretsByShip: new Map(),
    nextEntityId: 1,
    time: 0,
    queries: {
      ships: { entities: [] },
      projectiles: { entities: [] },
      turrets: { entities: [] },
    } as any,
    rng: { next: () => 0.5 } as any,
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
    },
  } as unknown as GameState;
}

function makeShipAndTurret(state: GameState): { ship: ShipEntity; turret: TurretEntity } {
  const rb = makeRigidBodyStub();
  const ship = {
    id: 1,
    rigidBody: rb as any,
    collider: { handle: 100, isValid: () => true } as any,
    transform: { position: new Vector3(0, 0, 0), rotation: new Quaternion(), scale: 1 },
    ship: {
      team: 'blue',
      hull: 'corvette' as any,
      hp: 10,
      maxHp: 10,
      shield: 0,
      maxShield: 0,
      cooldown: 0,
      fireRate: 1,
      damage: 1,
      projectileSpeed: 1,
      range: 1,
      speed: 0,
      bulletType: 'bullet:laser',
      velocity: new Vector3(0, 0, 0),
      angularVelocity: new Vector3(0, 0, 0),
      lateralAcceleration: 0,
      motion: createDefaultMotionStats(),
    },
    model: 'corvette' as any,
    shieldRipples: [],
    turrets: [],
  } as unknown as ShipEntity;

  applyProgressionDefaults(ship.ship, { maxHpOverride: ship.ship.maxHp });

  const tBody = makeRigidBodyStub();
  const turret: TurretEntity = {
    id: 2,
    rigidBody: tBody as any,
    collider: { handle: 101, isValid: () => true } as any,
    transform: { position: new Vector3(0, 0, 0), rotation: new Quaternion(), scale: 1 },
    turret: {
      parent: ship,
      offset: new Vector3(0, 0, 0),
      damage: 1,
      fireRate: 1,
      projectileSpeed: 1,
      range: 1,
      bulletType: '',
      cooldown: 0,
      index: 0,
      yaw: 0,
      pitch: 0,
      priority: 'any',
    },
  } as TurretEntity;

  (state.world.entities as any[]).push(ship, turret);
  (state.queries.ships as any).entities = [ship];
  (state.queries.turrets as any).entities = [turret];
  state.colliderLookup.set((ship.collider as any).handle, ship as any);
  state.colliderLookup.set((turret.collider as any).handle, turret as any);
  try {
    registerTurret(state, ship.id, turret);
  } catch {
    // ignore
  }
  return { ship, turret };
}

describe('Turret destruction', () => {
  it('removes turret entities when their parent ship is destroyed', () => {
    const state = makeStateStub();
    const { ship, turret } = makeShipAndTurret(state);

    // Sanity: both entities exist
    expect((state.queries.ships as any).entities.length).toBe(1);
    expect((state.queries.turrets as any).entities.length).toBe(1);

    // Destroy the ship
    destroyEntity(state, ship as any);

    // After destruction, turret should also have been removed
    expect((state.queries.ships as any).entities.length).toBe(0);
    expect((state.queries.turrets as any).entities.length).toBe(0);
    // Collider lookup should not contain turret handle
    expect(state.colliderLookup.has((turret.collider as any).handle)).toBe(false);
  });
});

