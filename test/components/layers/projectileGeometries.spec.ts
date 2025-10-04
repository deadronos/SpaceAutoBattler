import { describe, it, expect, afterEach } from 'vitest';
import { SphereGeometry } from 'three';
import { getProjectileGeometry, clearProjectileGeometryCache } from '../../../src/utils/projectileGeometries.js';
import { getProjectileBaseRadius } from '../../../src/config/projectiles.js';

describe('projectile geometry cache', () => {
  afterEach(() => {
    clearProjectileGeometryCache();
  });

  it('uses configured base radius for known bullet types', () => {
    const geom = getProjectileGeometry('bullet:laser');
    const sphere = geom as SphereGeometry;
    expect(sphere.parameters.radius).toBeCloseTo(getProjectileBaseRadius('bullet:laser'));
  });

  it('returns cached geometry instance on subsequent calls', () => {
    const first = getProjectileGeometry('bullet:laser');
    const second = getProjectileGeometry('bullet:laser');
    expect(second).toBe(first);
  });

  it('creates distinct geometry per bullet type', () => {
    const laser = getProjectileGeometry('bullet:laser');
    const heavy = getProjectileGeometry('bullet:heavy');
    expect(heavy).not.toBe(laser);
  });
});
