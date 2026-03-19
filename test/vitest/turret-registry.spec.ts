import { describe, it, expect, vi, beforeEach } from 'vite-plus/test';
import { createGameState, destroyEntity } from '../../src/game/state.js';
import { spawnShip } from '../../src/game/ships.js';
import { Vector3 } from 'three';
import * as registry from '../../src/game/turretRegistry.js';

describe('turret registry integration', () => {
  let state: any;

  beforeEach(async () => {
    state = await createGameState();
  });

  it('calls registerTurret when spawning a ship with turrets', () => {
    const spy = vi.spyOn(registry, 'registerTurret');
    spawnShip(state, {
      hull: 'corvette',
      team: 'blue',
      position: new Vector3(0, 0, 0),
      heading: 0,
    } as any);
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  it('calls unregisterTurret when destroying a ship (cascade)', async () => {
    const rSpy = vi.spyOn(registry, 'registerTurret');
    const uSpy = vi.spyOn(registry, 'unregisterTurret');
    const _ship = spawnShip(state, {
      hull: 'corvette',
      team: 'blue',
      position: new Vector3(1, 0, 0),
      heading: 0,
    } as any);
    // register should have been called while spawning
    expect(rSpy).toHaveBeenCalled();

    // Destroy the ship and expect unregister to have been called for turret entities
    destroyEntity(state, _ship as any);
    expect(uSpy).toHaveBeenCalled();

    rSpy.mockRestore();
    uSpy.mockRestore();
  });

  it('calls unregisterTurret when destroying a turret directly', async () => {
    const rSpy = vi.spyOn(registry, 'registerTurret');
    const uSpy = vi.spyOn(registry, 'unregisterTurret');
    const _ship = spawnShip(state, {
      hull: 'corvette',
      team: 'blue',
      position: new Vector3(2, 0, 0),
      heading: 0,
    } as any);
    // find one turret from the state's archetype or colliderLookup
    const turrets = [...(state.queries.turrets.entities as any[])];
    expect(turrets.length).toBeGreaterThan(0);
    const turret = turrets[0];

    // destroy the turret entity directly
    destroyEntity(state, turret as any);
    expect(uSpy).toHaveBeenCalled();

    rSpy.mockRestore();
    uSpy.mockRestore();
  });
});
