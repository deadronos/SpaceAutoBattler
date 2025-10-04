import { SphereGeometry } from 'three';
import type { BufferGeometry } from 'three';
import { getProjectileBaseRadius } from '../config/projectiles.js';

const geometryCache = new Map<string, SphereGeometry>();

export function getProjectileGeometry(bulletType?: string | null): BufferGeometry {
  const key = bulletType ?? 'bullet:laser';
  const cached = geometryCache.get(key);
  if (cached) {
    return cached;
  }
  const radius = getProjectileBaseRadius(key);
  const geometry = new SphereGeometry(radius, 16, 16);
  geometryCache.set(key, geometry);
  return geometry;
}

export function clearProjectileGeometryCache(): void {
  for (const geom of geometryCache.values()) {
    geom.dispose();
  }
  geometryCache.clear();
}
