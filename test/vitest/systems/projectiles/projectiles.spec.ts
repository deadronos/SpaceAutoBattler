import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Quaternion, Vector3 } from 'three';
import type { ProjectileEntity, ShipEntity } from '../../../../src/types/index.js';
import { createTestGameState, createTestShip } from '../../helpers/fixtures.js';

const spawnMock = vi.fn();
vi.mock('../../../../src/game/systems/projectiles/physicsAdapter.js', () => ({
  spawnProjectileEntity: spawnMock,
}));

let fireProjectile: typeof import('../../../../src/game/systems/projectiles/index.js').fireProjectile;
let steerProjectileTowardTarget: typeof import('../../../../src/game/systems/projectiles/homing.js').steerProjectileTowardTarget;
let createBeamHitInfo: typeof import('../../../../src/game/systems/projectiles/beam.js').createBeamHitInfo;

beforeEach(async () => {
  spawnMock.mockReset();
  ({ fireProjectile } = await import('../../../../src/game/systems/projectiles/index.js'));
  ({ steerProjectileTowardTarget } =
    await import('../../../../src/game/systems/projectiles/homing.js'));
  ({ createBeamHitInfo } = await import('../../../../src/game/systems/projectiles/beam.js'));
});

describe('projectiles module decomposition', () => {
  it('steers homing projectiles toward targets', () => {
    const projectile = {
      direction: new Vector3(0, 0, 1),
      transform: { position: new Vector3(0, 0, 0), rotation: new Quaternion() },
      projectile: { speed: 20, maxTtl: 5, ttl: 5 },
    } as unknown as ProjectileEntity;
    const target = createTestShip(2, 'red', new Vector3(10, 0, 10));

    steerProjectileTowardTarget(projectile, target, { turnRate: Math.PI, lead: false }, 0.1);

    expect(projectile.direction.x).toBeGreaterThan(0);
    expect(projectile.transform.rotation).toBeInstanceOf(Quaternion);
  });

  it('computes beam hit info and resolves target IDs', () => {
    const state = createTestGameState();
    const target = createTestShip(5, 'red', new Vector3(0, 0, 5));
    state.colliderLookup.set(42, target as ShipEntity);
    state.physicsWorld = {
      castRay: vi.fn().mockReturnValue({
        collider: { handle: 42 },
        timeOfImpact: 3,
      }),
    } as never;
    class FakeRay {
      constructor(
        public origin: Vector3,
        public dir: Vector3,
      ) {}
    }
    state.rapier = { Ray: FakeRay } as never;

    const info = createBeamHitInfo(state, new Vector3(), new Vector3(0, 0, 1), 10);
    expect(info.targetId).toBe(target.id);
    expect(info.distance).toBeCloseTo(3);
    expect(info.hitPoint.z).toBeCloseTo(3);
  });

  it('populates projectile runtime data during fireProjectile', async () => {
    const state = createTestGameState();
    state.time = 12;
    state.world = {
      add: vi.fn(),
    } as never;

    const origin = createTestShip(7, 'blue', new Vector3());
    const spawnedProjectiles: ProjectileEntity[] = [];
    spawnMock.mockImplementation((params, onSpawn) => {
      const projectile = {
        projectile: {
          ...params.projectile,
          beam: undefined,
          homing: undefined,
          targetId: undefined,
          category: undefined,
          spawnTime: 0,
          armingTime: 0,
          aoeRadius: 0,
        },
        transform: { position: new Vector3(), rotation: new Quaternion() },
        direction: params.direction.clone(),
      } as unknown as ProjectileEntity;
      onSpawn?.(projectile);
      spawnedProjectiles.push(projectile);
    });

    fireProjectile(state, origin, new Vector3(0, 0, 1));

    expect(spawnMock).toHaveBeenCalled();
    const [params] = spawnMock.mock.calls[0];
    expect(params.projectile.speed).toBeGreaterThan(0);
    const spawned = spawnedProjectiles[0].projectile;
    expect(spawned.category).toBe('bullet');
    expect(spawned.spawnTime).toBe(state.time);
    expect(spawned.homing).toBeUndefined();
  });
});
