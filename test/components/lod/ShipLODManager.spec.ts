import { describe, expect, it } from 'vitest';
import { Quaternion, Vector3 } from 'three';
import type { ShipEntity, Team } from '../../../src/types/index.js';
import { partitionShipsByDistance } from '../../../src/components/lod/ShipLODManager.js';

function createShip(id: number, distance: number): ShipEntity {
  return {
    id,
    rigidBody: null as any,
    collider: null as any,
    transform: {
      position: new Vector3(distance, 0, 0),
      rotation: new Quaternion(),
      scale: 1,
    },
    ship: {
      team: 'alliance' as Team,
      hull: 'fighter',
      hp: 10,
      maxHp: 10,
      shield: 0,
      maxShield: 0,
      cooldown: 0,
      fireRate: 0,
      damage: 0,
      projectileSpeed: 0,
      range: 0,
      speed: 0,
      velocity: new Vector3(),
      angularVelocity: new Vector3(),
      lateralAcceleration: 0,
      motion: { maxSpeed: 0, turnRate: 0, acceleration: 0 },
      effects: [],
      xp: 0,
      level: 1,
      xpToNext: 1,
      damageType: 'kinetic',
      levelBonuses: {} as any,
      subsystems: {} as any,
      armor: 0,
      captain: undefined,
    },
    muzzleFlashes: [],
  } as unknown as ShipEntity;
}

describe('partitionShipsByDistance', () => {
  it('classifies ships with hysteresis to avoid flicker', () => {
    const camera = new Vector3(0, 0, 0);
    const previous = new Map<number, 'near' | 'far'>();
    const ships = [createShip(1, 100), createShip(2, 800)];

    const first = partitionShipsByDistance(ships, camera, 500, 50, previous);
    expect(first.nearShips.map((s) => s.id)).toEqual([1]);
    expect(first.farShips.map((s) => s.id)).toEqual([2]);

    // Move the far ship just inside the hysteresis band; should remain far
    ships[1].transform.position.set(470, 0, 0);
    const second = partitionShipsByDistance(ships, camera, 500, 50, previous);
    expect(second.farShips.map((s) => s.id)).toContain(2);

    // Move clearly near; should flip now
    ships[1].transform.position.set(300, 0, 0);
    const third = partitionShipsByDistance(ships, camera, 500, 50, previous);
    expect(third.nearShips.map((s) => s.id)).toContain(2);
  });
});

