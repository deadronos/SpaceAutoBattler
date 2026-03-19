import { describe, expect, it } from 'vite-plus/test';
import { Vector3 } from 'three';
import { createTestGameState, createTestShip } from './helpers/fixtures.js';
import { fireProjectile } from '../../src/game/systems/projectiles.js';
import { flushPostPhysicsMutations } from '../../src/game/simulationQueue.js';
import {
  createRapierShim,
  createPhysicsWorldShim,
} from '../support/aiScenarioHarness/rapierShim.js';

describe('fireProjectile bulletType propagation', () => {
  it('attaches bulletType from fighter to projectile', () => {
    const state = createTestGameState();
    // provide minimal shims so post-step mutations can create physics objects
    state.rapier = createRapierShim();
    state.physicsWorld = createPhysicsWorldShim();
    state.world = {
      entities: [],
      add(obj: any) {
        (state.queries.projectiles.entities as any[]).push(obj);
        this.entities.push(obj);
        return obj;
      },
      createEntity(obj: any) {
        (state.queries.projectiles.entities as any[]).push(obj);
        this.entities.push(obj);
        return obj;
      },
      destroyEntity() {},
      remove() {},
    } as any;
    const ship = createTestShip(1, 'blue', new Vector3(0, 0, 0));
    ship.ship.bulletType = 'bullet:laser';

    fireProjectile(state, ship, new Vector3(0, 0, 1));
    expect(state.simulation.postStepMutations).toHaveLength(1);
    flushPostPhysicsMutations(state);
    expect((state.queries.projectiles as any).entities.length).toBe(1);

    const created = (state.queries.projectiles as any).entities[0];
    expect(created).toBeDefined();
    expect(created.projectile.bulletType).toBe('bullet:laser');
  });

  it('attaches heavy bullet type and sets larger scale', () => {
    const state = createTestGameState();
    // provide minimal shims so post-step mutations can create physics objects
    state.rapier = createRapierShim();
    state.physicsWorld = createPhysicsWorldShim();
    state.world = {
      entities: [],
      add(obj: any) {
        (state.queries.projectiles.entities as any[]).push(obj);
        this.entities.push(obj);
        return obj;
      },
      createEntity(obj: any) {
        (state.queries.projectiles.entities as any[]).push(obj);
        this.entities.push(obj);
        return obj;
      },
      destroyEntity() {},
      remove() {},
    } as any;
    const ship = createTestShip(2, 'red', new Vector3(0, 0, 0));
    ship.ship.bulletType = 'bullet:heavy';

    fireProjectile(state, ship, new Vector3(0, 0, 1));
    expect(state.simulation.postStepMutations).toHaveLength(1);
    flushPostPhysicsMutations(state);
    expect((state.queries.projectiles as any).entities.length).toBe(1);

    const created = (state.queries.projectiles as any).entities[0];
    expect(created.projectile.bulletType).toBe('bullet:heavy');
    // scale should be larger than default 0.2
    expect(created.transform.scale).toBeGreaterThan(0.25);
  });
});
