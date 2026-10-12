import { describe, it, expect, afterEach, vi, beforeEach } from 'vite-plus/test';
import React from 'react';
import { render, cleanup, act } from '@testing-library/react';
import { Vector3, Quaternion, Matrix4 } from 'three';
import type { ShipEntity } from '../../src/types/index.js';
import { ParticleTrails } from '../../src/components/ParticleTrails.js';
import { PlanetRings } from '../../src/components/environment/PlanetRings.js';
import { createParticleTrailResources } from '../../src/renderer/particles/trailResources.js';
import { PARTICLE_TRAILS_CONFIG } from '../../src/config/effects.js';

type FrameCallback = (state: { clock: { getElapsedTime: () => number } }, delta: number) => void;

const frameCallbacks: FrameCallback[] = [];

const mockCamera = {
  position: new Vector3(0, 0, 50),
  projectionMatrix: new Matrix4().makePerspective(-1, 1, 1, -1, 0.1, 1000),
  matrixWorldInverse: new Matrix4().makeTranslation(0, 0, -50),
};

vi.mock('@react-three/fiber', () => ({
  useFrame: (callback: FrameCallback) => {
    frameCallbacks.push(callback);
  },
  useThree: (selector: (s: any) => any) => selector({ camera: mockCamera }),
}));

vi.mock('@react-three/drei', () => ({
  useGLTF: Object.assign(() => ({ scene: null }), { setDecoderPath: vi.fn() }),
}));

// Controllable value consumed by the mocked reduced-motion hook so component
// tests can gate motion deterministically without touching the real matchMedia.
const reducedMotionState = vi.hoisted(() => ({ value: false }));

vi.mock('../../src/hooks/usePrefersReducedMotion.js', () => ({
  usePrefersReducedMotion: () => reducedMotionState.value,
}));

beforeEach(() => {
  reducedMotionState.value = false;
  frameCallbacks.length = 0;
});

afterEach(() => {
  cleanup();
  frameCallbacks.length = 0;
  reducedMotionState.value = false;
  vi.clearAllMocks();
});

function createTestShip(id: number, thrust: number, position?: Vector3): ShipEntity {
  const ship = {
    id,
    transform: {
      position: position || new Vector3(),
      rotation: new Quaternion(),
      scale: 1,
    },
    rigidBody: {} as unknown,
    collider: {} as unknown,
    ship: {
      team: 'blue',
      hull: 'fighter',
      hp: 1,
      maxHp: 1,
      shield: 0,
      maxShield: 0,
      cooldown: 0,
      fireRate: 0,
      damage: 0,
      projectileSpeed: 0,
      range: 0,
      speed: 0,
      xp: 0,
      level: 1,
      xpToNext: 1,
      damageType: 'kinetic',
      levelBonuses: {} as unknown,
      subsystems: {} as unknown,
      armor: 0,
      velocity: new Vector3(),
      angularVelocity: new Vector3(),
      motion: {
        mass: 1,
        maxSpeed: 1,
        linearAcceleration: 1,
        linearDamping: 1,
        maxTurnRate: 1,
        angularAcceleration: 1,
        angularDamping: 1,
      },
    },
    ai: { command: { thrust } },
  };

  return ship as unknown as ShipEntity;
}

function makeTrailResources(count = 32) {
  return createParticleTrailResources(count, {
    size: PARTICLE_TRAILS_CONFIG.size,
    color: PARTICLE_TRAILS_CONFIG.color,
    opacity: PARTICLE_TRAILS_CONFIG.opacity,
    additiveBlending: PARTICLE_TRAILS_CONFIG.additiveBlending,
    depthTest: PARTICLE_TRAILS_CONFIG.depthTest,
    depthWrite: PARTICLE_TRAILS_CONFIG.depthWrite,
  });
}

function runLatestFrame(time: number, delta: number): void {
  const callback = frameCallbacks[frameCallbacks.length - 1];
  expect(typeof callback).toBe('function');
  callback?.({ clock: { getElapsedTime: () => time } }, delta);
}

describe('usePrefersReducedMotion (real hook)', () => {
  it('reflects matchMedia and reacts to the change listener', async () => {
    const listeners = new Set<() => void>();
    const mediaQuery = {
      matches: true,
      media: '(prefers-reduced-motion: reduce)',
      onchange: null,
      addEventListener: (_type: string, cb: () => void) => {
        listeners.add(cb);
      },
      removeEventListener: (_type: string, cb: () => void) => {
        listeners.delete(cb);
      },
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    };
    const matchMediaSpy = vi.fn().mockReturnValue(mediaQuery);
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      configurable: true,
      value: matchMediaSpy,
    });

    const actual = await vi.importActual<
      typeof import('../../src/hooks/usePrefersReducedMotion.js')
    >('../../src/hooks/usePrefersReducedMotion.js');

    function Probe(): React.ReactElement {
      const prefers = actual.usePrefersReducedMotion();
      return <span data-testid="probe">{String(prefers)}</span>;
    }

    const { getByTestId } = render(<Probe />);
    expect(matchMediaSpy).toHaveBeenCalledWith('(prefers-reduced-motion: reduce)');
    expect(getByTestId('probe').textContent).toBe('true');

    mediaQuery.matches = false;
    act(() => {
      listeners.forEach((cb) => cb());
    });
    expect(getByTestId('probe').textContent).toBe('false');
  });
});

describe('ParticleTrails reduced-motion gating', () => {
  it('freezes emission and uTime when reduced motion is on', () => {
    reducedMotionState.value = true;
    const resources = makeTrailResources();
    render(<ParticleTrails ships={[createTestShip(1, 1)]} resources={resources} />);

    runLatestFrame(0.5, 0.5);
    const timeAfterFirst = resources.material.uniforms.uTime.value;
    runLatestFrame(1.0, 0.5);
    const timeAfterSecond = resources.material.uniforms.uTime.value;

    expect(resources.geometry.instanceCount).toBe(0);
    expect(timeAfterSecond).toBe(timeAfterFirst);
  });

  it('emits particles and advances uTime when reduced motion is off', () => {
    reducedMotionState.value = false;
    const resources = makeTrailResources();
    render(<ParticleTrails ships={[createTestShip(1, 1)]} resources={resources} />);

    runLatestFrame(0.5, 0.5);
    const timeAfterFirst = resources.material.uniforms.uTime.value;
    runLatestFrame(1.0, 0.5);

    expect(resources.geometry.instanceCount).toBeGreaterThan(0);
    expect(resources.material.uniforms.uTime.value).toBeGreaterThan(timeAfterFirst);
  });
});

describe('PlanetRings reduced-motion gating', () => {
  it('does not advance ring rotation when reduced motion is on', () => {
    reducedMotionState.value = true;
    const { container } = render(
      <PlanetRings innerRadius={10} outerRadius={20} rotationSpeed={1} />,
    );
    const mesh = container.querySelector('mesh') as unknown as { rotation: { z: number } };
    expect(mesh).toBeTruthy();
    mesh.rotation = { z: 0 };

    runLatestFrame(1, 1);
    expect(mesh.rotation.z).toBe(0);
  });

  it('advances ring rotation when reduced motion is off', () => {
    reducedMotionState.value = false;
    const { container } = render(
      <PlanetRings innerRadius={10} outerRadius={20} rotationSpeed={1} />,
    );
    const mesh = container.querySelector('mesh') as unknown as { rotation: { z: number } };
    expect(mesh).toBeTruthy();
    mesh.rotation = { z: 0 };

    runLatestFrame(1, 1);
    expect(mesh.rotation.z).toBeCloseTo(1, 10);
  });
});
