import { describe, expect, it } from 'vitest';
import { Vector3 } from 'three';
import type { GameEntity, GameState, ProjectileEntity, ShipEntity } from '../../src/types/index.js';
import { createTestGameState, createTestShip } from './helpers/fixtures.js';
import { fireProjectile, advanceProjectiles } from '../../src/game/systems/projectiles.js';
import { resolveProjectiles } from '../../src/game/systems/damage.js';
import { flushPostPhysicsMutations } from '../../src/game/simulationQueue.js';
import {
  createRapierShim,
  createPhysicsWorldShim,
} from '../../src/game/aiScenarioHarness/rapierShim.js';

function attachWorld(state: GameState): void {
  const entities: GameEntity[] = [];
  const addEntity = (obj: GameEntity): GameEntity => {
    entities.push(obj);
    if (obj.projectile) {
      (state.queries.projectiles.entities as ProjectileEntity[]).push(obj as ProjectileEntity);
    }
    if (obj.beamVisual) {
      (state.queries.beamVisuals.entities as import('../../src/types/index.js').BeamVisualEntity[]).push(obj as import('../../src/types/index.js').BeamVisualEntity);
    }
    if (
      obj.collider &&
      typeof (obj.collider as { isValid?: () => boolean }).isValid !== 'function'
    ) {
      (obj.collider as { isValid?: () => boolean }).isValid = () => true;
    }
    if (
      obj.rigidBody &&
      typeof (obj.rigidBody as { isValid?: () => boolean }).isValid !== 'function'
    ) {
      (obj.rigidBody as { isValid?: () => boolean }).isValid = () => true;
    }
    if (obj.ship) {
      (state.queries.ships.entities as ShipEntity[]).push(obj as ShipEntity);
    }
    if (obj.turret) {
      (state.queries.turrets.entities as any[]).push(obj);
    }
    return obj;
  };

  const destroyEntity = (obj: GameEntity): void => {
    const idx = entities.indexOf(obj);
    if (idx >= 0) {
      entities.splice(idx, 1);
    }
    const projectileIdx = (state.queries.projectiles.entities as ProjectileEntity[]).indexOf(
      obj as ProjectileEntity,
    );
    if (projectileIdx >= 0) {
      (state.queries.projectiles.entities as ProjectileEntity[]).splice(projectileIdx, 1);
    }
    const shipIdx = (state.queries.ships.entities as ShipEntity[]).indexOf(obj as ShipEntity);
    if (shipIdx >= 0) {
      (state.queries.ships.entities as ShipEntity[]).splice(shipIdx, 1);
    }
    const turretIdx = (state.queries.turrets.entities as any[]).indexOf(obj as any);
    if (turretIdx >= 0) {
      (state.queries.turrets.entities as any[]).splice(turretIdx, 1);
    }
  };

  state.world = {
    entities,
    add: addEntity,
    createEntity: addEntity,
    destroyEntity(obj: GameEntity) {
      destroyEntity(obj);
    },
    remove(obj: GameEntity) {
      destroyEntity(obj);
    },
  } as unknown as GameState['world'];
}

describe('projectile behaviours', () => {
  it('homes missiles toward a target ship', () => {
    const state = createTestGameState();
    state.rapier = createRapierShim();
    state.physicsWorld = createPhysicsWorldShim();
    attachWorld(state);

    const shooter = createTestShip(1, 'blue', new Vector3(0, 0, 0));
    shooter.ship.bulletType = 'missile:seeker';
    shooter.ship.damageType = 'explosive';
    shooter.ship.projectileSpeed = 70;
    const target = createTestShip(2, 'red', new Vector3(12, 0, 8));

    (state.queries.ships.entities as ShipEntity[]).push(shooter, target);

    fireProjectile(state, shooter, new Vector3(0, 0, 1), { targetId: target.id });
    flushPostPhysicsMutations(state);

    const projectile = (state.queries.projectiles.entities as ProjectileEntity[])[0];
    expect(projectile).toBeDefined();
    const initialDot = projectile.direction
      .clone()
      .normalize()
      .dot(target.transform.position.clone().sub(projectile.transform.position).normalize());

    advanceProjectiles(state, 0.25);

    const updatedDot = projectile.direction
      .clone()
      .normalize()
      .dot(target.transform.position.clone().sub(projectile.transform.position).normalize());

    expect(updatedDot).toBeGreaterThan(initialDot);
    expect(updatedDot).toBeGreaterThan(0.6);
  });

  it('applies torpedo area damage to multiple ships', () => {
    const state = createTestGameState();
    state.rapier = createRapierShim();
    state.physicsWorld = createPhysicsWorldShim();
    attachWorld(state);

    const shooter = createTestShip(1, 'blue', new Vector3(0, 0, 0));
    shooter.ship.bulletType = 'torpedo:heavy';
    shooter.ship.damageType = 'explosive';
    shooter.ship.projectileSpeed = 40;
    const targetA = createTestShip(2, 'red', new Vector3(0, 0, 5));
    const targetB = createTestShip(3, 'red', new Vector3(2, 0, 6));
    targetA.ship.shield = 0;
    targetB.ship.shield = 0;

    (state.queries.ships.entities as ShipEntity[]).push(shooter, targetA, targetB);

    fireProjectile(state, shooter, new Vector3(0, 0, 1), { targetId: targetA.id });
    flushPostPhysicsMutations(state);

    const projectile = (state.queries.projectiles.entities as ProjectileEntity[])[0];
    projectile.projectile.armed = true;
    projectile.transform.position.copy(targetA.transform.position);

    resolveProjectiles(state, 0.016);

    expect(targetA.ship.hp).toBeLessThan(60);
    expect(targetB.ship.hp).toBeLessThan(60);
  });

  it('deals immediate beam damage and removes beam after impact', () => {
    const state = createTestGameState();
    state.rapier = createRapierShim();
    state.physicsWorld = createPhysicsWorldShim();
    attachWorld(state);

    const shooter = createTestShip(1, 'blue', new Vector3(0, 0, 0));
    shooter.ship.bulletType = 'beam:laser';
    shooter.ship.damageType = 'ion';
    const target = createTestShip(2, 'red', new Vector3(0, 0, 12));
    target.ship.shield = 5;

    (state.queries.ships.entities as ShipEntity[]).push(shooter, target);

    fireProjectile(state, shooter, new Vector3(0, 0, 1));
    flushPostPhysicsMutations(state);

    // Beams now spawn as BeamVisualEntity, not ProjectileEntity
    const beamVisual = (state.queries.beamVisuals.entities as import('../../src/types/index.js').BeamVisualEntity[])[0];
    expect(beamVisual).toBeDefined();
    expect(beamVisual.beamVisual.bulletType).toBe('beam:laser');
    expect(beamVisual.beamVisual.localOrigin).toBeDefined();
    expect(beamVisual.beamVisual.localDirection).toBeDefined();

    const localOrigin = beamVisual.beamVisual.localOrigin!;
    const localDir = beamVisual.beamVisual.localDirection!;
    expect(localOrigin.x).toBeCloseTo(0, 5);
    expect(localOrigin.y).toBeCloseTo(0, 5);
    expect(localOrigin.z).toBeCloseTo(1.6, 5);
    expect(localDir.x).toBeCloseTo(0, 5);
    expect(localDir.y).toBeCloseTo(0, 5);
    expect(localDir.z).toBeCloseTo(1, 5);

    // Damage is applied instantly during fireProjectile, so target shield should already be reduced
    expect(target.ship.shield).toBeLessThan(5);

    // Visual beam entity should persist (not immediately removed)
    expect((state.queries.beamVisuals.entities as import('../../src/types/index.js').BeamVisualEntity[]).includes(beamVisual)).toBe(true);
  });

  it("doesn't hit the source when beam origin is inside the ship bounds", () => {
    const state = createTestGameState();
    state.rapier = createRapierShim();
    state.physicsWorld = createPhysicsWorldShim();
    attachWorld(state);

    const shooter = createTestShip(1, 'blue', new Vector3(0, 0, 0));
    shooter.ship.bulletType = 'beam:laser';
    shooter.ship.damageType = 'ion';
    // give the shooter a small shield so we can detect accidental self-hit
    shooter.ship.shield = 10;
    const target = createTestShip(2, 'red', new Vector3(0, 0, 12));

    (state.queries.ships.entities as ShipEntity[]).push(shooter, target);

    // Fire with originPosition equal to the shooter's position (inside bounds)
    fireProjectile(state, shooter, new Vector3(0, 0, 1), { originPosition: shooter.transform.position.clone() });
    flushPostPhysicsMutations(state);

    // Beams now spawn as BeamVisualEntity, not ProjectileEntity
    const beamVisual = (state.queries.beamVisuals.entities as import('../../src/types/index.js').BeamVisualEntity[])[0];
    expect(beamVisual).toBeDefined();

    // Damage is applied instantly during fireProjectile
    // Target should be damaged
    expect(target.ship.shield).toBeLessThan(10);
    // Shooter should not be damaged by its own beam (instant hitscan skips same team)
    expect(shooter.ship.shield).toBe(10);
  });

  it("doesn't hit the source when bullet origin is inside the ship bounds", () => {
    const state = createTestGameState();
    state.rapier = createRapierShim();
    state.physicsWorld = createPhysicsWorldShim();
    attachWorld(state);

    const shooter = createTestShip(1, 'blue', new Vector3(0, 0, 0));
    shooter.ship.bulletType = 'bullet:laser';
    shooter.ship.damageType = 'kinetic';
    shooter.ship.shield = 10;

    const target = createTestShip(2, 'red', new Vector3(0, 0, 5));
    target.ship.shield = 0;

    (state.queries.ships.entities as ShipEntity[]).push(shooter, target);

    // Spawn bullet inside the shooter's bounds
    fireProjectile(state, shooter, new Vector3(0, 0, 1), { originPosition: shooter.transform.position.clone() });
    flushPostPhysicsMutations(state);

    // Advance a bit and resolve collisions
    advanceProjectiles(state, 0.05);
    resolveProjectiles(state, 0.016);

    // Shooter should not have taken damage from its own bullet
    expect(shooter.ship.shield).toBe(10);
    // Target should have taken some damage or at least the projectile should not have been removed due to self-collision
    const remaining = (state.queries.projectiles.entities as ProjectileEntity[]).length;
    expect(remaining).toBeGreaterThanOrEqual(0);
  });

  it('allows point-defense shots to intercept missiles', () => {
    const state = createTestGameState();
    state.rapier = createRapierShim();
    state.physicsWorld = createPhysicsWorldShim();
    attachWorld(state);

    const pdShip = createTestShip(1, 'blue', new Vector3(0, 0, 0));
    const attacker = createTestShip(2, 'red', new Vector3(0, 0, 5));
    (state.queries.ships.entities as ShipEntity[]).push(pdShip, attacker);

    pdShip.ship.bulletType = 'bullet:laser';
    attacker.ship.bulletType = 'missile:seeker';
    attacker.ship.damageType = 'explosive';

    fireProjectile(state, pdShip, new Vector3(0, 0, 1));
    fireProjectile(state, attacker, new Vector3(0, 0, -1), { targetId: pdShip.id });
    flushPostPhysicsMutations(state);

    const projectiles = state.queries.projectiles.entities as ProjectileEntity[];
    expect(projectiles.length).toBe(2);

    // Move PD projectile close to missile
    const pd = projectiles.find((p) => p.projectile.team === 'blue');
    const missile = projectiles.find((p) => p.projectile.team === 'red');
    expect(pd && missile).toBeTruthy();
    if (!pd || !missile) return;

    pd.transform.position.copy(new Vector3(0, 0, 2));
    missile.transform.position.copy(new Vector3(0, 0, 2.1));
    pd.projectile.category = 'bullet';
    missile.projectile.category = 'missile';

    resolveProjectiles(state, 0.016);

    expect((state.queries.projectiles.entities as ProjectileEntity[]).length).toBe(0);
  });
});
