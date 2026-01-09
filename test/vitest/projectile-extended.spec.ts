import { describe, it, expect, beforeEach } from 'vitest';
import { Vector3, Quaternion } from 'three';
import { advanceProjectiles, fireProjectile } from '../../src/game/systems/projectiles.js';
import { resolveProjectiles } from '../../src/game/systems/damage.js';
import { flushPostPhysicsMutations } from '../../src/game/simulationQueue.js';
import { createTestGameState, createTestShip } from './helpers/fixtures.js';
import type { ProjectileEntity, ShipEntity, GameState } from '../../src/types/index.js';

function createProjectileEntity(partial: Partial<ProjectileEntity>): ProjectileEntity {
  const base: ProjectileEntity = {
    id: 1,
    rigidBody: {
      setNextKinematicTranslation: () => {},
      setNextKinematicRotation: () => {},
      isValid: () => true,
    } as never,
    collider: {
      handle: Math.floor(Math.random() * 100000),
      isValid: () => true,
    } as never,
    transform: {
      position: new Vector3(),
      rotation: new Quaternion(),
      scale: 1,
    },
    projectile: {
      team: 'blue',
      damage: 10,
      ttl: 5,
      maxTtl: 5,
      speed: 20,
      damageType: 'kinetic',
    } as any,
    direction: new Vector3(0, 0, 1),
  } as ProjectileEntity;
  return { ...base, ...partial };
}

describe('extended projectile behaviours', () => {
  let state: GameState;
  let attacker: ShipEntity;
  let target: ShipEntity;

  beforeEach(() => {
    attacker = createTestShip(1, 'blue', new Vector3(0, 0, 0));
    target = createTestShip(2, 'red', new Vector3(0, 0, 0));
    state = createTestGameState({
      time: 0,
      queries: {
        ships: { entities: [attacker, target] },
        projectiles: { entities: [] },
        turrets: { entities: [] },
      },
      colliderLookup: new Map(),
      simulation: {
        ...createTestGameState().simulation,
        deferredMutations: [],
        postStepMutations: [],
      },
      world: {
        add: (entity: any) => {
          (state.queries.projectiles.entities as ProjectileEntity[]).push(entity);
          return entity;
        },
        remove: (entity: ProjectileEntity) => {
          const list = state.queries.projectiles.entities as ProjectileEntity[];
          const index = list.indexOf(entity);
          if (index >= 0) {
            list.splice(index, 1);
          }
        },
      } as any,
      physicsWorld: {
        createRigidBody: () => ({
          setNextKinematicTranslation: () => {},
          setNextKinematicRotation: () => {},
          isValid: () => true,
        }),
        createCollider: () => ({ handle: Math.random(), isValid: () => true }),
        removeCollider: () => {},
        removeRigidBody: () => {},
        castRay: () => null,
      } as any,
      rapier: {
        RigidBodyDesc: {
          kinematicPositionBased: () => ({
            translation: { x: 0, y: 0, z: 0 },
            rotation: { x: 0, y: 0, z: 0, w: 1 },
            setTranslation(x: number, y: number, z: number) {
              this.translation = { x, y, z };
              return this;
            },
            setRotation(rot: { x: number; y: number; z: number; w: number }) {
              this.rotation = { ...rot };
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
        Ray: class {
          origin: Vector3;
          dir: Vector3;
          constructor(origin: Vector3, dir: Vector3) {
            this.origin = origin.clone();
            this.dir = dir.clone();
          }
        },
      } as any,
    });
  });

  it('prevents damage before arming time elapses', () => {
    const projectile = createProjectileEntity({
      id: 99,
      transform: {
        position: target.transform.position.clone(),
        rotation: new Quaternion(),
        scale: 0.5,
      },
      projectile: {
        team: attacker.ship.team,
        damage: 20,
        ttl: 5,
        maxTtl: 5,
        speed: 0,
        bulletType: 'torpedo:standard',
        damageType: attacker.ship.damageType,
        sourceId: attacker.id,
        armingTime: 1,
        spawnTime: state.time,
      },
    });
    (state.queries.projectiles.entities as ProjectileEntity[]).push(projectile);

    resolveProjectiles(state, 0.1);
    expect(target.ship.hp).toBe(60);

    state.time = 1.2;
    resolveProjectiles(state, 0.1);
    expect(target.ship.hp).toBeLessThan(60);
  });

  it('applies aoe damage to nearby enemies', () => {
    const nearby = createTestShip(3, 'red', new Vector3(3, 0, 0));
    state.queries.ships.entities.push(nearby);
    state.shipById.set(nearby.id, nearby);

    const projectile = createProjectileEntity({
      id: 101,
      transform: {
        position: target.transform.position.clone(),
        rotation: new Quaternion(),
        scale: 0.5,
      },
      projectile: {
        team: attacker.ship.team,
        damage: 40,
        ttl: 5,
        maxTtl: 5,
        speed: 0,
        bulletType: 'torpedo:standard',
        damageType: attacker.ship.damageType,
        sourceId: attacker.id,
        aoeRadius: 5,
        spawnTime: state.time,
      },
    });
    (state.queries.projectiles.entities as ProjectileEntity[]).push(projectile);

    resolveProjectiles(state, 0.1);
    expect(target.ship.hp).toBeLessThan(60);
    expect(nearby.ship.hp).toBeLessThan(60);
  });

  it('steers homing projectile toward assigned target', () => {
    const projectile = createProjectileEntity({
      id: 200,
      transform: {
        position: new Vector3(0, 0, 0),
        rotation: new Quaternion(),
        scale: 0.5,
      },
      direction: new Vector3(0, 0, 1),
      projectile: {
        team: attacker.ship.team,
        damage: 10,
        ttl: 5,
        maxTtl: 5,
        speed: 10,
        bulletType: 'missile:light',
        damageType: attacker.ship.damageType,
        sourceId: attacker.id,
        homing: { turnRate: Math.PI },
        targetId: target.id,
      },
    });
    target.transform.position.set(5, 0, 5);
    (state.queries.projectiles.entities as ProjectileEntity[]).push(projectile);

    advanceProjectiles(state, 0.5);
    expect(projectile.direction.x).toBeGreaterThan(0.2);
    expect(projectile.transform.position.z).toBeGreaterThan(0);
  });

  it('uses shipById map for homing lookup even when queries lack target', () => {
    const mappedTarget = createTestShip(5, 'red', new Vector3(8, 0, 8));
    state.shipById.set(mappedTarget.id, mappedTarget);
    // simulate missing from queries list to force map usage
    state.queries.ships.entities = [];

    const projectile = createProjectileEntity({
      id: 201,
      transform: {
        position: new Vector3(0, 0, 0),
        rotation: new Quaternion(),
        scale: 0.5,
      },
      direction: new Vector3(0, 0, 1),
      projectile: {
        team: attacker.ship.team,
        damage: 10,
        ttl: 5,
        maxTtl: 5,
        speed: 10,
        bulletType: 'missile:light',
        damageType: attacker.ship.damageType,
        sourceId: attacker.id,
        homing: { turnRate: Math.PI },
        targetId: mappedTarget.id,
      },
    });
    (state.queries.projectiles.entities as ProjectileEntity[]).push(projectile);

    advanceProjectiles(state, 0.5);
    expect(projectile.direction.x).toBeGreaterThan(0.1);
  });

  it('beam projectile deals damage once and expires after ttl', () => {
    const beam = createProjectileEntity({
      id: 300,
      transform: {
        position: attacker.transform.position.clone(),
        rotation: new Quaternion(),
        scale: 0.4,
      },
      projectile: {
        team: attacker.ship.team,
        damage: 25,
        ttl: 0.4,
        maxTtl: 0.4,
        speed: 0,
        bulletType: 'beam:laser',
        damageType: attacker.ship.damageType,
        sourceId: attacker.id,
        category: 'beam',
        beam: {
          ttl: 0.4,
          maxLength: 20,
          width: 0.5,
          hitPoint: target.transform.position.clone(),
          applied: false,
        },
        targetId: target.id,
      },
    });
    (state.queries.projectiles.entities as ProjectileEntity[]).push(beam);

    const initialHp = target.ship.hp;
    resolveProjectiles(state, 0.05);
    expect(target.ship.hp).toBeLessThan(initialHp);
    expect((state.queries.projectiles.entities as ProjectileEntity[]).length).toBe(1);

    state.time += 0.5;
    resolveProjectiles(state, 0.5);
    expect((state.queries.projectiles.entities as ProjectileEntity[]).length).toBe(0);
  });

  it('fireProjectile populates beam runtime using raycast hit', () => {
    const hitShip = createTestShip(4, 'red', new Vector3(0, 0, 15));
    state.queries.ships.entities.push(hitShip);
    state.shipById.set(hitShip.id, hitShip);

    const colliderHandle = 1234;
    state.colliderLookup.set(colliderHandle, hitShip as any);
    state.physicsWorld.castRay = () => ({ collider: { handle: colliderHandle }, toi: 15 });

    fireProjectile(state, attacker, new Vector3(0, 0, 1), {
      override: {
        bulletType: 'beam:laser',
        projectileCategory: 'beam',
      },
      originPosition: attacker.transform.position.clone(),
    });

    flushPostPhysicsMutations(state);
    const spawned = (state.queries.projectiles.entities as ProjectileEntity[])[0];
    expect(spawned.projectile.category).toBe('beam');
    expect(spawned.projectile.beam?.hitPoint?.z).toBeCloseTo(15, 3);
    expect(spawned.projectile.targetId).toBe(hitShip.id);
  });

  it('applies aoe damage from the point of impact, not the target center', () => {
    // Primary target large so we can hit it far from center
    target.transform.scale = 10;
    // Hit radius is approx 9.6 (calculated as scale * 0.9 + projRadius, i.e., 10 * 0.9 + 0.6).

    const secondaryTarget = createTestShip(3, 'red', new Vector3(0, 0, 13));
    state.queries.ships.entities.push(secondaryTarget);
    state.shipById.set(secondaryTarget.id, secondaryTarget);

    const projectile = createProjectileEntity({
      id: 102,
      transform: {
        position: new Vector3(0, 0, 9), // Hits the primary target near the edge
        rotation: new Quaternion(),
        scale: 0.5,
      },
      projectile: {
        team: attacker.ship.team,
        damage: 10,
        ttl: 5,
        maxTtl: 5,
        speed: 0,
        bulletType: 'torpedo:standard',
        damageType: attacker.ship.damageType,
        sourceId: attacker.id,
        aoeRadius: 5,
        spawnTime: state.time,
      },
    });
    (state.queries.projectiles.entities as ProjectileEntity[]).push(projectile);

    const initialHpPrimary = target.ship.hp;
    const initialHpSecondary = secondaryTarget.ship.hp;

    resolveProjectiles(state, 0.1);

    expect(target.ship.hp).toBeLessThan(initialHpPrimary);
    expect(secondaryTarget.ship.hp).toBeLessThan(initialHpSecondary);
  });

  it('spawns torpedoes with default homing configuration', () => {
    attacker.ship.bulletType = 'torpedo:standard';
    attacker.ship.projectileSpeed = 55;

    fireProjectile(state, attacker, new Vector3(0, 0, 1), {
      originPosition: attacker.transform.position.clone(),
      targetId: target.id,
    });

    flushPostPhysicsMutations(state);
    const spawned = (state.queries.projectiles.entities as ProjectileEntity[])[0];
    expect(spawned.projectile.homing).toBeDefined();
    expect(spawned.projectile.homing?.turnRate).toBeCloseTo(Math.PI / 3, 5);
  });
});
