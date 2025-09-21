import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// We'll mock three's SphereGeometry (sphereGeometry constructor is used via JSX as <sphereGeometry args={[r, 16, 16]} />)
vi.mock('three', async () => {
  const actual = await vi.importActual<any>('three');
  // Provide a fake SphereGeometry function that records its args
  const SphereGeometry = function (...args: any[]) {
    (SphereGeometry as any).lastArgs = args;
    return { args } as any;
  };
  return {
    ...actual,
    SphereGeometry,
    // Also expose Mesh for types (not strictly necessary)
    Mesh: actual.Mesh
  };
});

// Mock material registry since ProjectileObject imports it
vi.mock('../../src/renderer/materialRegistry.js', () => ({
  getMaterial: () => undefined
}));

import { ProjectileObject } from '../../src/components/Projectile.js';
import { PROJECTILE_CONFIG } from '../../src/config/projectiles.js';

function makeProjectileEntity(bulletType?: string, scale = 1) {
  return {
    id: 1,
    rigidBody: {} as any,
    collider: {} as any,
    transform: {
      position: { x: 0, y: 0, z: 0, clone() { return this; }, copy() {} },
      rotation: { x: 0, y: 0, z: 0, w: 1, copy() {} },
      scale
    },
    projectile: {
      team: 'blue',
      damage: 1,
      ttl: 1,
      maxTtl: 1,
      speed: 10,
      bulletType
    },
    direction: { x: 0, y: 0, z: 1 }
  } as any;
}

describe('Projectile geometry uses config radius', () => {
  beforeEach(() => {
    // reset lastArgs
    (require('three').SphereGeometry as any).lastArgs = undefined;
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it('uses baseGeometryRadius from config for laser', () => {
    const entity = makeProjectileEntity('bullet:laser', 1);
    // Call component function directly so its body (and JSX creation) runs
    ProjectileObject({ entity } as any);
    const lastArgs = (require('three').SphereGeometry as any).lastArgs;
    expect(lastArgs).toBeDefined();
    expect(lastArgs[0]).toBe(PROJECTILE_CONFIG['bullet:laser'].baseGeometryRadius);
  });

  it('uses baseGeometryRadius for heavy', () => {
    const entity = makeProjectileEntity('bullet:heavy', 1);
    ProjectileObject({ entity } as any);
    const lastArgs = (require('three').SphereGeometry as any).lastArgs;
    expect(lastArgs[0]).toBe(PROJECTILE_CONFIG['bullet:heavy'].baseGeometryRadius);
  });
});
