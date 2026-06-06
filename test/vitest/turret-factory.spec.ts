import { describe, it, expect, vi, beforeEach } from 'vite-plus/test';
import { Vector3, Quaternion } from 'three';
import { createGameState } from '../../src/game/state.js';
import { spawnShip } from '../../src/game/ships.js';
import { createTurretEntities } from '../../src/game/turretFactory.js';
import * as registry from '../../src/game/turretRegistry.js';
import type { GameState, ShipEntity } from '../../src/types/index.js';

describe('createTurretEntities', () => {
  let state: GameState;
  let parent: ShipEntity;

  beforeEach(async () => {
    state = await createGameState();
    parent = spawnShip(state, {
      hull: 'corvette',
      team: 'blue',
      position: new Vector3(0, 0, 0),
      heading: 0,
    });
  });

  it('registers turrets with the parent ship', () => {
    const spy = vi.spyOn(registry, 'registerTurret');
    const spec = {
      offset: new Vector3(1, 0, 0),
      damage: 10,
      fireRate: 0.5,
      projectileSpeed: 80,
      range: 200,
      bulletType: 'plasma',
    };
    createTurretEntities(state, parent, [spec], new Vector3(), new Quaternion());
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith(state, parent.id, expect.any(Object));
    spy.mockRestore();
  });

  it('assigns cooldown from the seeded RNG', () => {
    const rngSpy = vi.spyOn(state.rng, 'next');
    const spec = {
      offset: new Vector3(0, 1, 0),
      damage: 8,
      fireRate: 1.0,
      projectileSpeed: 60,
      range: 150,
      bulletType: 'laser',
    };
    createTurretEntities(state, parent, [spec], new Vector3(), new Quaternion());
    // cooldown = spec.fireRate * state.rng.next()
    expect(rngSpy).toHaveBeenCalled();
    rngSpy.mockRestore();

    // Verify the turret was added to the world
    const turrets = (state.queries.turrets.entities as any[]).filter(
      (t: any) => t.turret && t.turret.parent?.id === parent.id,
    );
    expect(turrets.length).toBeGreaterThanOrEqual(1);
  });

  it('uses default priority "any" when not specified', () => {
    const spec = {
      offset: new Vector3(-1, 0, 0),
      damage: 12,
      fireRate: 0.8,
      projectileSpeed: 70,
      range: 180,
      bulletType: 'kinetic',
      // priority omitted
    };
    createTurretEntities(state, parent, [spec], new Vector3(), new Quaternion());
    const turrets = (state.queries.turrets.entities as any[]).filter(
      (t: any) => t.turret && t.turret.parent?.id === parent.id,
    );
    expect(turrets[0].turret.priority).toBe('any');
  });

  it('creates sensor collider bodies for turrets', () => {
    const spec = {
      offset: new Vector3(2, 0, 0),
      damage: 6,
      fireRate: 0.3,
      projectileSpeed: 90,
      range: 250,
      bulletType: 'ion',
    };
    createTurretEntities(state, parent, [spec], new Vector3(), new Quaternion());
    const turrets = (state.queries.turrets.entities as any[]).filter(
      (t: any) => t.turret && t.turret.parent?.id === parent.id,
    );
    const turret = turrets[0];
    expect(turret.rigidBody).toBeDefined();
    expect(turret.collider).toBeDefined();
    expect(turret.collider.handle).toBeGreaterThan(0);
  });

  it('respects explicit priority values', () => {
    const spec = {
      offset: new Vector3(0, -1, 0),
      damage: 15,
      fireRate: 2.0,
      projectileSpeed: 100,
      range: 300,
      bulletType: 'plasma',
      priority: 'antiFighter' as const,
    };
    createTurretEntities(state, parent, [spec], new Vector3(), new Quaternion());
    const turrets = (state.queries.turrets.entities as any[]).filter(
      (t: any) => t.turret && t.turret.parent?.id === parent.id,
    );
    expect(turrets[0].turret.priority).toBe('antiFighter');
  });
});
