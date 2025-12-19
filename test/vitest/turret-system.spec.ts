import { describe, expect, it, vi, beforeEach } from 'vitest';
import { Vector3, Quaternion } from 'three';
import { updateTurrets } from '../../src/game/systems/turrets.js';
import { createTestGameState, createTestShip } from './helpers/fixtures.js';
import type { TurretEntity, GameState } from '../../src/types/index.js';

// Mock fireProjectile to verify it's called
vi.mock('../../src/game/systems/projectiles.js', () => ({
  fireProjectile: vi.fn(),
  TEMP_POS: new Vector3(),
}));

import { fireProjectile } from '../../src/game/systems/projectiles.js';

describe('updateTurrets system', () => {
  let state: GameState;

  beforeEach(() => {
    state = createTestGameState();
    vi.clearAllMocks();
  });

  it('fires at nearest enemy within range', () => {
    // 1. Create friendly ship with a turret
    const friendlyShip = createTestShip(1, 'blue', new Vector3(0, 0, 0));
    // Fix rotation to be a real Quaternion with methods
    friendlyShip.transform.rotation = new Quaternion();

    state.shipById.set(friendlyShip.id, friendlyShip);
    (state.queries.ships.entities as any[]).push(friendlyShip);

    // 2. Create independent turret entity attached to friendly ship
    const turretEntity: TurretEntity = {
      id: 100,
      rigidBody: { setNextKinematicTranslation: () => {} } as any,
      collider: {} as any,
      transform: {
        position: new Vector3(0, 0, 0),
        rotation: new Quaternion(),
        scale: 1,
      },
      turret: {
        parent: friendlyShip,
        offset: new Vector3(0, 2, 0),
        damage: 10,
        fireRate: 1,
        projectileSpeed: 100,
        range: 500,
        cooldown: 0,
        priority: 'any',
      },
    };
    (state.queries.turrets.entities as any[]).push(turretEntity);

    // 3. Create enemy ship within range
    const enemyShip = createTestShip(2, 'red', new Vector3(0, 0, 100)); // 100 units away (Z axis)
    enemyShip.transform.rotation = new Quaternion();
    state.shipById.set(enemyShip.id, enemyShip);
    (state.queries.ships.entities as any[]).push(enemyShip);

    // 4. Update turrets
    updateTurrets(state, 0.1);

    // 5. Verify fireProjectile was called
    expect(fireProjectile).toHaveBeenCalled();

    // check args
    const calls = (fireProjectile as any).mock.calls;
    expect(calls.length).toBe(1);
    const [calledState, calledShip, calledDir, calledOpts] = calls[0];

    expect(calledState).toBe(state);
    expect(calledShip).toBe(friendlyShip);

    // Calculate expected direction
    const turretPos = new Vector3(0, 2, 0);
    const targetPos = new Vector3(0, 0, 100);
    const expectedDir = targetPos.clone().sub(turretPos).normalize();

    expect(calledDir.x).toBeCloseTo(expectedDir.x);
    expect(calledDir.y).toBeCloseTo(expectedDir.y);
    expect(calledDir.z).toBeCloseTo(expectedDir.z);

    expect(calledOpts.targetId).toBe(enemyShip.id);
  });

  it('respects turret range', () => {
    const friendlyShip = createTestShip(1, 'blue', new Vector3(0, 0, 0));
    friendlyShip.transform.rotation = new Quaternion();
    (state.queries.ships.entities as any[]).push(friendlyShip);

    const turretEntity: TurretEntity = {
      id: 100,
      rigidBody: { setNextKinematicTranslation: () => {} } as any,
      collider: {} as any,
      transform: {
        position: new Vector3(0, 0, 0),
        rotation: new Quaternion(),
        scale: 1,
      },
      turret: {
        parent: friendlyShip,
        offset: new Vector3(0, 0, 0),
        damage: 10,
        fireRate: 1,
        projectileSpeed: 100,
        range: 50, // Short range
        cooldown: 0,
        priority: 'any',
      },
    };
    (state.queries.turrets.entities as any[]).push(turretEntity);

    // Enemy is out of range (100 > 50)
    const enemyShip = createTestShip(2, 'red', new Vector3(0, 0, 100));
    enemyShip.transform.rotation = new Quaternion();
    (state.queries.ships.entities as any[]).push(enemyShip);

    updateTurrets(state, 0.1);

    expect(fireProjectile).not.toHaveBeenCalled();
  });
});
