import { describe, it, expect } from 'vitest';
import { Quaternion, Vector3 } from 'three';
import { fireProjectile } from '../../src/game/systems.js';
import type { GameState, ShipEntity, ProjectileEntity } from '../../src/types/index.js';

function makeStateStub(): GameState {
  // Minimal stub with world, rapier, physicsWorld, eventQueue etc. We only need world.createEntity
  const entities: any[] = [];
  const world = {
    entities,
    createEntity(obj: any) {
      entities.push(obj);
      return obj;
    }
  } as any;

  const rapierStub = {
    RigidBodyDesc: {
      kinematicPositionBased: () => ({
        setTranslation() { return this; },
        setRotation() { return this; }
      })
    },
    ColliderDesc: {
      ball: () => ({
        setActiveEvents() { return this; },
        setActiveCollisionTypes() { return this; }
      })
    },
    ActiveEvents: { COLLISION_EVENTS: 1 },
    ActiveCollisionTypes: { ALL: 1 }
  } as any;

  return {
    rapier: rapierStub,
    physicsWorld: {
      createRigidBody: () => ({
        translation() { return { x: 0, y: 0, z: 0 }; },
        rotation() { return { x: 0, y: 0, z: 0, w: 1 }; }
      } as any),
      createCollider: () => ({ handle: Math.floor(Math.random() * 10000) }) as any
    } as any,
    eventQueue: {} as any,
    world: world as any,
    colliderLookup: new Map(),
    nextEntityId: 1,
    time: 0,
    queries: { ships: { entities: [] }, projectiles: { entities: [] } } as any,
    rng: { next: () => 0.5 } as any,
    paused: false,
    timeScale: 1
  } as unknown as GameState;
}

function makeShipEntity(hull: any, team: 'blue'|'red', bulletType?: string): ShipEntity {
  return {
    id: 1,
    rigidBody: {} as any,
    collider: {} as any,
    transform: {
      position: new Vector3(0,0,0),
      rotation: new Quaternion(),
      scale: 1
    },
    ship: {
      team,
      hull,
      hp: 10,
      maxHp: 10,
      shield: 5,
      maxShield: 5,
      cooldown: 0,
      fireRate: 1,
      damage: 2,
      projectileSpeed: 10,
      range: 12,
      speed: 5,
      bulletType
    },
    model: hull
  } as unknown as ShipEntity;
}

describe('fireProjectile bulletType propagation', () => {
  it('attaches bulletType from fighter to projectile', () => {
    const state = makeStateStub();
    const ship = makeShipEntity('fighter', 'blue', 'bullet:laser');

    fireProjectile(state, ship, new Vector3(0,0,1));

    const created = state.world.entities[0] as ProjectileEntity;
    expect(created).toBeDefined();
    expect(created.projectile.bulletType).toBe('bullet:laser');
  });

  it('attaches heavy bullet type and sets larger scale', () => {
    const state = makeStateStub();
    const ship = makeShipEntity('destroyer', 'red', 'bullet:heavy');

    fireProjectile(state, ship, new Vector3(0,0,1));

    const created = state.world.entities[0] as ProjectileEntity;
    expect(created.projectile.bulletType).toBe('bullet:heavy');
    // scale should be larger than default 0.2
    expect(created.transform.scale).toBeGreaterThan(0.25);
  });
});
