import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock three's SphereGeometry so we can capture constructor args
vi.mock('three', async () => {
  const actual = await vi.importActual<any>('three');
  const SphereGeometry = function (...args: any[]) {
    (SphereGeometry as any).lastArgs = args;
    return { args } as any;
  } as any;
  return {
    ...actual,
    SphereGeometry,
    Mesh: actual.Mesh
  };
});

// Mock material registry
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

describe('Projectile renderer (react-test-renderer) geometry radius', () => {
  beforeEach(() => {
    (require('three').SphereGeometry as any).lastArgs = undefined;
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it('renders sphere geometry with configured base radius for laser', () => {
    const entity = makeProjectileEntity('bullet:laser', 1);
    // Call the component function directly to create the element and trigger geometry construction
    // This avoids needing react-test-renderer in the test environment.
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    ProjectileObject({ entity } as any);
    const lastArgs = (require('three').SphereGeometry as any).lastArgs;
    expect(lastArgs).toBeDefined();
    expect(lastArgs[0]).toBe(PROJECTILE_CONFIG['bullet:laser'].baseGeometryRadius);
  });

  it('renders sphere geometry with configured base radius for heavy', () => {
    const entity = makeProjectileEntity('bullet:heavy', 1);
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    ProjectileObject({ entity } as any);
    const lastArgs = (require('three').SphereGeometry as any).lastArgs;
    expect(lastArgs[0]).toBe(PROJECTILE_CONFIG['bullet:heavy'].baseGeometryRadius);
  });
});
