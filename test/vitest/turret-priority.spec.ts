import { describe, it, expect } from 'vite-plus/test';
import { Quaternion, Vector3 } from 'three';
import { updateTurrets } from '../../src/game/systems/turrets.js';
import { createDefaultMotionStats } from '../../src/game/ships.js';
import { createProgressionDefaults } from '../../src/game/progression.js';
import type { GameState, ShipEntity, TurretEntity } from '../../src/types/index.js';

// --- Mocks and Stubs (copied/adapted from turrets.spec.ts) ---

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
  // Minimal stub for GameState
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
      createCollider: () => ({ handle: 1, isValid: () => true }),
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
      projectileSpeed: 10,
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
  } as unknown as ShipEntity;

  (state.queries.ships as any).entities.push(ship);
  state.shipById.set(id, ship);
  return ship;
}

function createTurretEntity(
  state: GameState,
  parent: ShipEntity,
  priority: 'antiFighter' | 'antiCapital',
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
    collider: { handle: 999, isValid: () => true } as any,
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

describe('Turret Prioritization Bug', () => {
  it('should prioritize fighter over frigate even if fighter is slightly further', () => {
    const state = makeStateStub();

    // Blue ship with anti-fighter turret at origin
    const blueShip = createShip(state, 1, 'blue', 'frigate', new Vector3(0, 0, 0));
    createTurretEntity(state, blueShip, 'antiFighter');

    // Red Fighter at distance 200
    const redFighter = createShip(state, 2, 'red', 'fighter', new Vector3(200, 0, 0));

    // Red Frigate at distance 195 (closer than fighter)
    const redFrigate = createShip(state, 3, 'red', 'frigate', new Vector3(195, 0, 0));

    // Run turrets update
    updateTurrets(state, 0.016);

    // Process post-step mutations (where projectiles are spawned)
    for (const mutation of state.simulation.postStepMutations) {
      mutation();
    }

    // Check projectiles
    const projectiles = (state.queries.projectiles as any).entities;
    expect(projectiles.length).toBe(1);

    const projectile = projectiles[0];

    // The bug: it targets the Frigate (id 3) because it's closer, ignoring priority
    // Ideally (after fix), it should target the Fighter (id 2)
    // For now, I assert the current buggy behavior to confirm reproduction,
    // or I assert the DESIRED behavior and expect it to fail.

    // I will assert the desired behavior, so the test fails.
    expect(projectile.projectile.targetId).toBe(redFighter.id);
  });

  it('should prioritize fighter over frigate even with large distance difference (robustness check)', () => {
    const state = makeStateStub();

    // Blue ship with anti-fighter turret at origin
    const blueShip = createShip(state, 1, 'blue', 'frigate', new Vector3(0, 0, 0));
    createTurretEntity(state, blueShip, 'antiFighter');

    // Red Fighter at distance 900 (far but in range)
    const redFighter = createShip(state, 2, 'red', 'fighter', new Vector3(900, 0, 0));

    // Red Frigate at distance 100 (very close)
    const redFrigate = createShip(state, 3, 'red', 'frigate', new Vector3(100, 0, 0));

    // Run turrets update
    updateTurrets(state, 0.016);

    // Process post-step mutations (where projectiles are spawned)
    for (const mutation of state.simulation.postStepMutations) {
      mutation();
    }

    // Check projectiles
    const projectiles = (state.queries.projectiles as any).entities;
    expect(projectiles.length).toBe(1);

    const projectile = projectiles[0];

    expect(projectile.projectile.targetId).toBe(redFighter.id);
  });
});
