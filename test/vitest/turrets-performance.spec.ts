import { describe, it, expect, vi, beforeEach } from 'vite-plus/test';
import { updateTurrets } from '../../src/game/systems/turrets.js';
import { SpatialGrid } from '../../src/utils/spatialGrid.js';
import { Vector3, Quaternion } from 'three';
import * as progression from '../../src/game/progression.js';

describe('updateTurrets performance', () => {
  let state: any;
  let turretEntity: any;
  let shipEntity: any;
  let enemyEntity: any;
  let queryNearestSpy: any;

  beforeEach(() => {
    queryNearestSpy = vi.spyOn(SpatialGrid.prototype, 'queryNearest');

    // Mock getSubsystemMultiplier to return 1.0
    vi.spyOn(progression, 'getSubsystemMultiplier').mockReturnValue(1.0);

    shipEntity = {
      id: 1,
      ship: {
        team: 1,
        hull: 'frigate',
        subsystems: {
          weapons: { status: 'ok' },
        },
      },
      transform: {
        position: new Vector3(0, 0, 0),
        rotation: new Quaternion(),
        scale: 1,
      },
      rigidBody: {},
    };

    enemyEntity = {
      id: 2,
      ship: { team: 2, hull: 'fighter' },
      transform: {
        position: new Vector3(100, 0, 0),
        rotation: new Quaternion(),
      },
    };

    turretEntity = {
      turret: {
        parent: shipEntity,
        offset: new Vector3(0, 0, 0),
        cooldown: 0,
        range: 1000,
        fireRate: 1,
        damage: 10,
        projectileSpeed: 100,
        priority: 'any',
      },
      rigidBody: {},
    };

    state = {
      queries: {
        turrets: { entities: [turretEntity] },
        ships: { entities: [shipEntity, enemyEntity] },
        projectiles: { entities: [] },
      },
      shipById: new Map([
        [1, shipEntity],
        [2, enemyEntity],
      ]),
      simulation: {
        deferredMutations: [],
        postStepMutations: [],
      },
    };
  });

  it('queries the ship grid when not on cooldown', () => {
    turretEntity.turret.cooldown = 0;

    updateTurrets(state, 0.1);

    expect(queryNearestSpy).toHaveBeenCalledTimes(1);
  });

  it('skips the ship grid query when on cooldown', () => {
    turretEntity.turret.cooldown = 10; // High cooldown
    queryNearestSpy.mockClear();

    updateTurrets(state, 0.1);

    expect(queryNearestSpy).not.toHaveBeenCalled();
  });
});
