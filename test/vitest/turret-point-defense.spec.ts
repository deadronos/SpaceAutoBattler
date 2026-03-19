import { describe, expect, it } from 'vite-plus/test';
import { Quaternion, Vector3 } from 'three';
import { updateTurrets } from '../../src/game/systems/turrets.js';
import { createDefaultMotionStats } from '../../src/game/ships.js';
import { createProgressionDefaults } from '../../src/game/progression.js';
import type {
  GameState,
  ProjectileEntity,
  ShipEntity,
  TurretEntity,
} from '../../src/types/index.js';

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
  const queries = {
    ships: { entities: [] as any[] },
    turrets: { entities: [] as any[] },
    projectiles: { entities: [] as any[] },
  } as any;
  const shipById = new Map<number, ShipEntity>();

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

  return {
    rapier: rapierStub,
    physicsWorld: {
      createRigidBody: (desc?: any) =>
        makeRigidBodyStub(desc ? { pos: desc._pos, rot: desc._rot } : undefined),
      createCollider: () => ({ handle: Math.floor(Math.random() * 10000), isValid: () => true }),
      removeCollider() {},
      removeRigidBody() {},
    },
    eventQueue: {} as any,
    world: {
      add: (e: any) => {
        entities.push(e);
        if (e.ship) queries.ships.entities.push(e);
        if (e.turret) queries.turrets.entities.push(e);
        if (e.projectile) queries.projectiles.entities.push(e);
        return e;
      },
      remove: (e: any) => {
        const index = entities.indexOf(e);
        if (index >= 0) entities.splice(index, 1);
        const shipIndex = queries.ships.entities.indexOf(e);
        if (shipIndex >= 0) queries.ships.entities.splice(shipIndex, 1);
        const turretIndex = queries.turrets.entities.indexOf(e);
        if (turretIndex >= 0) queries.turrets.entities.splice(turretIndex, 1);
        const projIndex = queries.projectiles.entities.indexOf(e);
        if (projIndex >= 0) queries.projectiles.entities.splice(projIndex, 1);
      },
    } as any,
    colliderLookup: new Map(),
    shipById,
    nextEntityId: 1,
    time: 0,
    queries,
    rng: { next: () => 0.5 } as any,
    paused: false,
    timeScale: 1,
    explosions: [],
    explosionPool: [],
    progressionEvents: new Map(),
    uiFlags: { hudHealthBars: false },
    ai: {
      metrics: undefined,
    } as any,
    simulation: {
      deferredMutations: [] as any[],
      postStepMutations: [] as any[],
      rapierDiagnostics: {} as any,
      subsystemTimings: {
        durations: {},
        lastTickIndex: -1,
        lastTickTime: 0,
      },
    } as any,
  } as unknown as GameState;
}

function createShip(
  state: GameState,
  id: number,
  team: 'blue' | 'red',
  hull: 'fighter' | 'frigate',
  pos: Vector3,
): ShipEntity {
  const rb = makeRigidBodyStub({ pos: { x: pos.x, y: pos.y, z: pos.z } });
  const progression = createProgressionDefaults(hull);
  const ship: ShipEntity = {
    id,
    rigidBody: rb,
    collider: { handle: id, isValid: () => true } as any,
    transform: { position: pos.clone(), rotation: new Quaternion(), scale: 1 },
    ship: {
      team,
      hull,
      hp: 100,
      maxHp: 100,
      shield: 0,
      maxShield: 0,
      cooldown: 0,
      fireRate: 1,
      damage: 10,
      projectileSpeed: 100,
      range: 1000,
      speed: 0,
      bulletType: 'bullet:heavy',
      velocity: new Vector3(),
      angularVelocity: new Vector3(),
      lateralAcceleration: 0,
      motion: createDefaultMotionStats(),
      ...progression,
    },
    model: hull,
    shieldRipples: [],
    turrets: [],
  } as unknown as ShipEntity;

  (state.queries.ships as any).entities.push(ship);
  state.shipById.set(id, ship);
  return ship;
}

function createTurretEntity(
  state: GameState,
  parent: ShipEntity,
  priority: 'antiProjectile' | 'antiFighter' | 'antiCapital' | 'any',
): TurretEntity {
  const rb = makeRigidBodyStub({
    pos: {
      x: parent.transform.position.x,
      y: parent.transform.position.y,
      z: parent.transform.position.z,
    },
  });
  const turretEntity: TurretEntity = {
    id: state.nextEntityId++,
    rigidBody: rb,
    collider: { handle: Math.floor(Math.random() * 10000), isValid: () => true } as any,
    transform: {
      position: parent.transform.position.clone(),
      rotation: new Quaternion(),
      scale: 1,
    },
    turret: {
      parent,
      offset: new Vector3(0, 0, 0),
      damage: 10,
      fireRate: 1,
      projectileSpeed: 100,
      range: 1000,
      bulletType: 'bullet:laser',
      cooldown: 0,
      index: 0,
      yaw: 0,
      pitch: 0,
      minYaw: -Math.PI,
      maxYaw: Math.PI,
      minPitch: -Math.PI,
      maxPitch: Math.PI,
      priority,
    },
  } as unknown as TurretEntity;

  (state.queries.turrets as any).entities.push(turretEntity);
  return turretEntity;
}

function createProjectile(
  state: GameState,
  id: number,
  team: 'blue' | 'red',
  pos: Vector3,
  targetId?: number,
): ProjectileEntity {
  const projectile: ProjectileEntity = {
    id,
    rigidBody: {
      setNextKinematicTranslation: () => {},
      setNextKinematicRotation: () => {},
      isValid: () => true,
    } as any,
    collider: { handle: id + 1000, isValid: () => true } as any,
    transform: {
      position: pos.clone(),
      rotation: new Quaternion(),
      scale: 1,
    },
    projectile: {
      team,
      damage: 10,
      ttl: 5,
      maxTtl: 5,
      speed: 20,
      bulletType: 'missile:light',
      damageType: 'kinetic',
      category: 'missile',
      targetId,
      homing: { turnRate: Math.PI / 2, lead: true },
    },
    direction: new Vector3(0, 0, 1),
  };
  (state.queries.projectiles as any).entities.push(projectile);
  return projectile;
}

describe('point defense turret targeting', () => {
  it('prioritizes hostile projectiles when antiProjectile is set', () => {
    const state = makeStateStub();
    const blueShip = createShip(state, 1, 'blue', 'frigate', new Vector3(0, 0, 0));
    createTurretEntity(state, blueShip, 'antiProjectile');
    createShip(state, 2, 'red', 'fighter', new Vector3(200, 0, 0));

    const projectile = createProjectile(state, 999, 'red', new Vector3(30, 0, 0), blueShip.id);

    updateTurrets(state, 0.016);
    const projectiles = state.queries.projectiles.entities as ProjectileEntity[];
    expect(projectiles).not.toContain(projectile);
  });

  it('falls back to ship targeting when no projectile exists', () => {
    const state = makeStateStub();
    const blueShip = createShip(state, 1, 'blue', 'frigate', new Vector3(0, 0, 0));
    createTurretEntity(state, blueShip, 'antiProjectile');
    const redShip = createShip(state, 2, 'red', 'fighter', new Vector3(200, 0, 0));

    updateTurrets(state, 0.016);

    for (const mutation of state.simulation.postStepMutations) {
      mutation();
    }

    const projectiles = state.queries.projectiles.entities as ProjectileEntity[];
    expect(projectiles.length).toBe(1);
    expect(projectiles[0].projectile.targetId).toBe(redShip.id);
  });
});
