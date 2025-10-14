import { CapsuleGeometry, CylinderGeometry, SphereGeometry } from 'three';
import type { BufferGeometry } from 'three';
import {
  getProjectileBaseRadius,
  getProjectileBeamConfig,
  getProjectileCategory,
  getProjectileConfig,
} from '../config/projectiles.js';

const geometryCache = new Map<string, BufferGeometry>();

export function getProjectileGeometry(bulletType?: string | null): BufferGeometry {
  const key = bulletType ?? 'bullet:laser';
  const cached = geometryCache.get(key);
  if (cached) {
    return cached;
  }
  const category = getProjectileCategory(key);
  const radius = getProjectileBaseRadius(key);
  let geometry: BufferGeometry;

  switch (category) {
    case 'missile': {
      const capsule = new CapsuleGeometry(radius * 0.6, radius * 1.6, 6, 12);
      capsule.rotateX(Math.PI / 2);
      geometry = capsule;
      break;
    }
    case 'torpedo': {
      const length = radius * 3.2;
      const torpedo = new CylinderGeometry(radius * 0.9, radius * 0.6, length, 12, 1, false);
      torpedo.rotateX(Math.PI / 2);
      geometry = torpedo;
      break;
    }
    case 'beam': {
      // Create a unit beam geometry (1 unit length, 1 unit diameter) and let
      // the renderer scale each instance non-uniformly to match desired width/length.
      const beam = new CylinderGeometry(0.5, 0.5, 1, 12, 1, true);
      beam.rotateX(Math.PI / 2);
      geometry = beam;
      break;
    }
    case 'bullet':
    default: {
      const base = getProjectileConfig(key);
      const segments = base.visualMultiplier && base.visualMultiplier > 1.1 ? 20 : 16;
      geometry = new SphereGeometry(radius, segments, segments);
      break;
    }
  }

  geometryCache.set(key, geometry);
  return geometry;
}

export function clearProjectileGeometryCache(): void {
  for (const geom of geometryCache.values()) {
    geom.dispose();
  }
  geometryCache.clear();
}
