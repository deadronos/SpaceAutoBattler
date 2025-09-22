import { describe, expect, it } from 'vitest';
import { Quaternion, Vector3 } from 'three';
import { findNearestEnemy } from '../../src/game/systems.js';
import { createDefaultMotionStats } from '../../src/game/ships.js';
import type { GameState, ShipEntity } from '../../src/types/index.js';

function createShip(id: number, team: 'blue' | 'red', position: Vector3): ShipEntity {
  return {
    id,
    rigidBody: {} as never,
    collider: {} as never,
    transform: {
      position: position.clone(),
      rotation: new Quaternion(),
      scale: 1,
    },
    ship: {
      team,
      hull: 'fighter',
      hp: 30,
      maxHp: 30,
      shield: 18,
      maxShield: 18,
      cooldown: 0,
      fireRate: 1,
      damage: 4,
      projectileSpeed: 10,
      range: 12,
      speed: 5,
      velocity: new Vector3(0, 0, 0),
      angularVelocity: 0,
      motion: createDefaultMotionStats(),
    },
    model: 'fighter',
  };
}

describe('findNearestEnemy', () => {
  it('returns the closest opposing ship', () => {
    const origin = createShip(1, 'blue', new Vector3(0, 0, 0));
    const farEnemy = createShip(2, 'red', new Vector3(10, 0, 0));
    const nearEnemy = createShip(3, 'red', new Vector3(3, 0, 0));
    const ally = createShip(4, 'blue', new Vector3(1, 0, 0));

    const state = {
      queries: {
        ships: {
          entities: [origin, farEnemy, nearEnemy, ally],
        },
      },
    } as unknown as GameState;

    const result = findNearestEnemy(state, origin);
    expect(result).toBe(nearEnemy);
  });

  it('returns null when no opponents exist', () => {
    const origin = createShip(1, 'blue', new Vector3());
    const ally = createShip(2, 'blue', new Vector3(2, 0, 0));

    const state = {
      queries: {
        ships: {
          entities: [origin, ally],
        },
      },
    } as unknown as GameState;

    const result = findNearestEnemy(state, origin);
    expect(result).toBeNull();
  });
});
