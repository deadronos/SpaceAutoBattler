import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('react', async () => {
  const actual = await vi.importActual<typeof import('react')>('react');
  return {
    ...actual,
    useRef: <T,>(initial: T | null) => ({ current: initial }),
  };
});

vi.mock('@react-three/fiber', () => ({
  useFrame: () => undefined,
}));

// Mock material registry
vi.mock('../../src/renderer/materialRegistry.js', () => ({
  getMaterial: () => undefined
}));

vi.mock('../../src/renderer/BloomProvider.js', () => ({
  useBloomRegistration: () => undefined,
}));

import type { ReactElement, JSXElementConstructor } from 'react';
import { ProjectileObject } from '../../src/components/Projectile.js';
import { getProjectileBaseRadius } from '../../src/config/projectiles.js';

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
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('renders sphere geometry with configured base radius for laser', () => {
    const entity = makeProjectileEntity('bullet:laser', 1);
    const element = ProjectileObject({ entity } as any) as AnyReactElement;
    const args = findSphereArgs(element);
    expect(args).toBeDefined();
    expect(args?.[0]).toBe(getProjectileBaseRadius('bullet:laser'));
  });

  it('renders sphere geometry with configured base radius for heavy', () => {
    const entity = makeProjectileEntity('bullet:heavy', 1);
    const element = ProjectileObject({ entity } as any) as AnyReactElement;
    const args = findSphereArgs(element);
    expect(args?.[0]).toBe(getProjectileBaseRadius('bullet:heavy'));
  });
});

type AnyReactElement = ReactElement<Record<string, unknown>, string | JSXElementConstructor<any>>;

function findSphereArgs(element: AnyReactElement): unknown[] | undefined {
  const children = element.props.children;
  const list = Array.isArray(children) ? children : [children];
  const sphere = list.find(
    (child) => child && typeof child === 'object' && (child as AnyReactElement).type === 'sphereGeometry'
  ) as AnyReactElement | undefined;
  const args = sphere?.props?.args;
  return Array.isArray(args) ? args : undefined;
}
