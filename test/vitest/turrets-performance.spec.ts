import { describe, it, expect, vi, beforeEach } from 'vitest';
import { updateTurrets } from '../../src/game/systems/turrets.js';
import { GameState, TurretEntity, ShipEntity } from '../../src/types/index.js';
import * as targetSelection from '../../src/game/utils/targetSelection.js';
import { Vector3, Quaternion } from 'three';
import * as progression from '../../src/game/progression.js';

describe('updateTurrets performance', () => {
  let state: any;
  let turretEntity: any;
  let shipEntity: any;
  let enemyEntity: any;
  let findNearestEnemySpy: any;

  beforeEach(() => {
    findNearestEnemySpy = vi.spyOn(targetSelection, 'findNearestEnemy');

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

  it('calls findNearestEnemy when not on cooldown', () => {
    turretEntity.turret.cooldown = 0;
    findNearestEnemySpy.mockReturnValue(enemyEntity);

    updateTurrets(state, 0.1);

    expect(findNearestEnemySpy).toHaveBeenCalled();
  });

  it('skips findNearestEnemy when on cooldown (optimized behavior)', () => {
    turretEntity.turret.cooldown = 10; // High cooldown
    findNearestEnemySpy.mockClear();

    updateTurrets(state, 0.1);

    expect(findNearestEnemySpy).not.toHaveBeenCalled();
  });
});
