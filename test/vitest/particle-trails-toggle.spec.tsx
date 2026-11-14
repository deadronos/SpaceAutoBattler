import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test';
import React from 'react';
import { cleanup, render } from '@testing-library/react';
import { Matrix4, Quaternion, Vector3 } from 'three';
import type { ShipEntity } from '../../src/types/index.js';
import { ParticleTrails } from '../../src/components/ParticleTrails.js';
import { PARTICLE_TRAILS_CONFIG } from '../../src/config/effects.js';
import { createParticleTrailResources } from '../../src/renderer/particles/trailResources.js';

const mockCamera = {
  position: new Vector3(0, 0, 50),
  projectionMatrix: new Matrix4().makePerspective(-1, 1, 1, -1, 0.1, 1000),
  matrixWorldInverse: new Matrix4().makeTranslation(0, 0, -50),
};

vi.mock('@react-three/fiber', () => ({
  useFrame: vi.fn(),
  useThree: (selector: (s: { camera: typeof mockCamera }) => unknown) =>
    selector({ camera: mockCamera }),
}));

vi.mock('@react-three/drei', () => ({
  useGLTF: Object.assign(() => ({ scene: null }), { setDecoderPath: vi.fn() }),
}));

function createTestShip(): ShipEntity {
  return {
    id: 1,
    transform: {
      position: new Vector3(),
      rotation: new Quaternion(),
      scale: 1,
    },
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
      levelBonuses: {},
      subsystems: {},
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
    ai: { command: { thrust: 1 } },
  } as unknown as ShipEntity;
}

describe('ParticleTrails conditional enabled toggle', () => {
  const originalEnabled = PARTICLE_TRAILS_CONFIG.enabled;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    cleanup();
    PARTICLE_TRAILS_CONFIG.enabled = originalEnabled;
    consoleErrorSpy.mockRestore();
    vi.clearAllMocks();
  });

  it('toggles PARTICLE_TRAILS_CONFIG.enabled with provided resources without hook-order errors', () => {
    const resources = createParticleTrailResources(8, {
      size: PARTICLE_TRAILS_CONFIG.size,
      color: PARTICLE_TRAILS_CONFIG.color,
      opacity: PARTICLE_TRAILS_CONFIG.opacity,
      additiveBlending: PARTICLE_TRAILS_CONFIG.additiveBlending,
      depthTest: PARTICLE_TRAILS_CONFIG.depthTest,
      depthWrite: PARTICLE_TRAILS_CONFIG.depthWrite,
    });
    const ships = [createTestShip()];

    PARTICLE_TRAILS_CONFIG.enabled = false;
    const { rerender, container } = render(<ParticleTrails ships={ships} resources={resources} />);
    expect(container.querySelector('mesh')).toBeNull();

    PARTICLE_TRAILS_CONFIG.enabled = true;
    rerender(<ParticleTrails ships={ships} resources={resources} />);
    expect(container.querySelector('mesh')).not.toBeNull();

    PARTICLE_TRAILS_CONFIG.enabled = false;
    rerender(<ParticleTrails ships={ships} resources={resources} />);
    expect(container.querySelector('mesh')).toBeNull();

    PARTICLE_TRAILS_CONFIG.enabled = true;
    rerender(<ParticleTrails ships={ships} resources={resources} />);
    expect(container.querySelector('mesh')).not.toBeNull();

    const hookErrors = consoleErrorSpy.mock.calls.filter((call) =>
      String(call[0]).toLowerCase().includes('hook'),
    );
    expect(hookErrors).toHaveLength(0);
  });

  it('toggles PARTICLE_TRAILS_CONFIG.enabled with owned resources cleanly', () => {
    const ships = [createTestShip()];

    PARTICLE_TRAILS_CONFIG.enabled = false;
    const { rerender, container } = render(<ParticleTrails ships={ships} />);
    expect(container.querySelector('mesh')).toBeNull();

    PARTICLE_TRAILS_CONFIG.enabled = true;
    rerender(<ParticleTrails ships={ships} />);
    expect(container.querySelector('mesh')).not.toBeNull();

    PARTICLE_TRAILS_CONFIG.enabled = false;
    rerender(<ParticleTrails ships={ships} />);
    expect(container.querySelector('mesh')).toBeNull();

    const hookErrors = consoleErrorSpy.mock.calls.filter((call) =>
      String(call[0]).toLowerCase().includes('hook'),
    );
    expect(hookErrors).toHaveLength(0);
  });
});
