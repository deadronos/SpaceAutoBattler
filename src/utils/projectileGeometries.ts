import { CylinderGeometry, SphereGeometry } from 'three';
import type { BufferGeometry } from 'three';
import {
  getProjectileBaseRadius,
  getProjectileCategory,
  getProjectileConfig,
  type ProjectileConfigItem,
} from '../config/projectiles.js';

const geometryCache = new Map<string, BufferGeometry>();

function createMissileGeometry(config: ProjectileConfigItem): BufferGeometry {
  const radius = config.baseGeometryRadius ?? getProjectileBaseRadius('missile:light');
  const length = Math.max(1, radius * 6);
  const geometry = new CylinderGeometry(radius * 0.5, radius * 0.8, length, 12, 1);
  geometry.rotateX(Math.PI / 2);
  return geometry;
}

function createTorpedoGeometry(config: ProjectileConfigItem): BufferGeometry {
  const radius = config.baseGeometryRadius ?? getProjectileBaseRadius('torpedo:standard');
  const length = Math.max(1, radius * 7);
  const geometry = new CylinderGeometry(radius * 0.7, radius, length, 12, 1);
  geometry.rotateX(Math.PI / 2);
  return geometry;
}

function createBeamGeometry(config: ProjectileConfigItem): BufferGeometry {
  const radius = config.beam?.width
    ? config.beam.width / 2
    : (config.baseGeometryRadius ?? getProjectileBaseRadius('beam:laser'));
  const length = Math.max(2, (config.visualScale ?? 1) * 12);
  const geometry = new CylinderGeometry(radius, radius, length, 16, 1, true);
  geometry.rotateX(Math.PI / 2);
  return geometry;
}

function createDefaultGeometry(key: string, config: ProjectileConfigItem): BufferGeometry {
  const category = getProjectileCategory(key);
  if (category === 'missile') {
    return createMissileGeometry(config);
  }
  if (category === 'torpedo') {
    return createTorpedoGeometry(config);
  }
  if (category === 'beam') {
    return createBeamGeometry(config);
  }
  const radius = getProjectileBaseRadius(key);
  return new SphereGeometry(radius, 16, 16);
}

export function getProjectileGeometry(bulletType?: string | null): BufferGeometry {
  const key = bulletType ?? 'bullet:laser';
  const cached = geometryCache.get(key);
  if (cached) {
    return cached;
  }
  const config = getProjectileConfig(key);
  const geometry = createDefaultGeometry(key, config);
  geometryCache.set(key, geometry);
  return geometry;
}

export function clearProjectileGeometryCache(): void {
  for (const geom of geometryCache.values()) {
    geom.dispose();
  }
  geometryCache.clear();
}
