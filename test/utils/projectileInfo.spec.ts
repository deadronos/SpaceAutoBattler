import { describe, expect, it } from 'vite-plus/test';
import { Matrix4, Quaternion, Vector3 } from 'three';
import type { DamageType, ProjectileEntity, Team } from '../../src/types/index.js';
import {
  computeBeamTransform,
  resolveProjectileInfo,
  resolveProjectileCategory,
  type ResolvedProjectileInfo,
} from '../../src/utils/projectileInfo.js';

function createBeamProjectile(info: ResolvedProjectileInfo): ProjectileEntity {
  const position = new Vector3(0, 0, 0);
  const rotation = new Quaternion();
  const direction = new Vector3(0, 0, 1);
  const ttl = info.beamConfig?.ttl ?? 0.4;
  return {
    id: 1,
    rigidBody: {} as any,
    collider: {} as any,
    transform: {
      position,
      rotation,
      scale: info.visualScale,
    },
    projectile: {
      team: 'blue' as Team,
      damage: 10,
      ttl,
      maxTtl: ttl,
      speed: 200,
      bulletType: info.key,
      damageType: 'kinetic' as DamageType,
      sourceId: 42,
      beam: {
        ttl,
        maxLength: 50,
        width: info.beamConfig?.width,
        hitPoint: undefined,
        applied: false,
      },
    },
    direction,
  } as unknown as ProjectileEntity;
}

describe('resolveProjectileInfo', () => {
  it('returns detailed configuration for known projectile keys', () => {
    const laser = resolveProjectileInfo('bullet:laser');
    expect(laser.key).toBe('bullet:laser');
    expect(laser.category).toBe('bullet');
    expect(laser.visualScale).toBeCloseTo(0.5);
    expect(laser.colliderRadius).toBeCloseTo(0.6, 5);

    const missile = resolveProjectileInfo('missile:light');
    expect(missile.category).toBe('missile');
    expect(missile.colliderRadius).toBeCloseTo(0.45, 5);

    const beam = resolveProjectileInfo('beam:laser');
    expect(beam.category).toBe('beam');
    expect(beam.beamConfig?.ttl).toBeCloseTo(0.4);
    expect(beam.metadata.baseLength).toBeGreaterThan(0);
  });

  it('falls back to the laser configuration for unknown keys', () => {
    const info = resolveProjectileInfo('unknown:type');
    expect(info.key).toBe('bullet:laser');
    expect(info.category).toBe('bullet');
  });

  it('resolves projectile category consistently', () => {
    expect(resolveProjectileCategory('torpedo:standard')).toBe('torpedo');
    expect(resolveProjectileCategory('nonexistent')).toBe('bullet');
  });
});

describe('computeBeamTransform', () => {
  it('computes matrix and scale factors for beam projectiles', () => {
    const info = resolveProjectileInfo('beam:laser');
    const projectile = createBeamProjectile(info);
    const tempMatrix = new Matrix4();
    const tempScale = new Vector3();
    const tempPosition = new Vector3();

    const result = computeBeamTransform({
      projectile,
      info,
      matrix: tempMatrix,
      scratchScale: tempScale,
      scratchPosition: tempPosition,
    });

    const extractedPosition = new Vector3();
    const extractedRotation = new Quaternion();
    const extractedScale = new Vector3();
    result.matrix.decompose(extractedPosition, extractedRotation, extractedScale);

    expect(extractedPosition.z).toBeCloseTo(25); // half of maxLength (50)
    expect(result.lengthScale).toBeCloseTo(50 / (info.metadata.baseLength ?? 1));
    expect(result.widthScale).toBeGreaterThan(0);
    expect(extractedScale.z).toBeCloseTo(result.lengthScale);
    expect(extractedRotation.equals(projectile.transform.rotation)).toBe(true);
  });

  it('uses beam hit point when provided to determine length', () => {
    const info = resolveProjectileInfo('beam:laser');
    const projectile = createBeamProjectile(info);
    projectile.projectile.beam = {
      ttl: info.beamConfig?.ttl ?? 0.4,
      maxLength: 200,
      width: info.beamConfig?.width,
      hitPoint: new Vector3(0, 0, 30),
      applied: false,
    };

    const result = computeBeamTransform({ projectile, info });
    expect(result.lengthScale).toBeCloseTo(30 / (info.metadata.baseLength ?? 1));
  });
});
