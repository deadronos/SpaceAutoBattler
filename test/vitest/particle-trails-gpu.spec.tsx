import { describe, it, expect, afterEach, vi } from 'vitest';
import React from 'react';
import { render, cleanup } from '@testing-library/react';
import { Vector3, Quaternion } from 'three';
import type { ShipEntity } from '../../src/types/index.js';
import { ParticleTrails } from '../../src/components/ParticleTrails.js';
import { createParticleTrailResources } from '../../src/renderer/particles/trailResources.js';
import { PARTICLE_TRAILS_CONFIG } from '../../src/config/effects.js';

const frameCallbacks: Array<
  (state: { clock: { getElapsedTime: () => number } }, delta: number) => void
> = [];

vi.mock('@react-three/fiber', () => ({
  useFrame: (
    callback: (state: { clock: { getElapsedTime: () => number } }, delta: number) => void,
  ) => {
    frameCallbacks.push(callback);
  },
}));

vi.mock('@react-three/drei', () => ({
  useGLTF: () => ({ scene: null }),
}));

afterEach(() => {
  cleanup();
  frameCallbacks.length = 0;
  vi.clearAllMocks();
});

function createTestShip(thrust: number): ShipEntity {
  const ship = {
    id: 1,
    transform: {
      position: new Vector3(),
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

function runLatestFrame(time: number, delta: number): void {
  const callback = frameCallbacks[frameCallbacks.length - 1];
  expect(typeof callback).toBe('function');
  callback?.({ clock: { getElapsedTime: () => time } }, delta);
}

describe('ParticleTrails GPU buffers', () => {
  it('creates instanced attributes sized to configuration', () => {
    const resources = createParticleTrailResources(32, {
      size: PARTICLE_TRAILS_CONFIG.size,
      color: PARTICLE_TRAILS_CONFIG.color,
      opacity: PARTICLE_TRAILS_CONFIG.opacity,
      additiveBlending: PARTICLE_TRAILS_CONFIG.additiveBlending,
      depthTest: PARTICLE_TRAILS_CONFIG.depthTest,
      depthWrite: PARTICLE_TRAILS_CONFIG.depthWrite,
    });

    expect(resources.geometry.instanceCount).toBe(0);
    expect(resources.arrays.spawnPosition).toHaveLength(32 * 3);
    expect(resources.arrays.velocity).toHaveLength(32 * 3);
    expect(resources.arrays.spawnTime).toHaveLength(32);
    expect(resources.arrays.lifetime).toHaveLength(32);
    expect(resources.arrays.scale).toHaveLength(32);
    expect(resources.attributes.spawnPosition.itemSize).toBe(3);
    expect(resources.attributes.spawnTime.itemSize).toBe(1);
  });

  it('writes spawn data into GPU buffers when ships thrust', () => {
    const resources = createParticleTrailResources(16, {
      size: PARTICLE_TRAILS_CONFIG.size,
      color: PARTICLE_TRAILS_CONFIG.color,
      opacity: PARTICLE_TRAILS_CONFIG.opacity,
      additiveBlending: PARTICLE_TRAILS_CONFIG.additiveBlending,
      depthTest: PARTICLE_TRAILS_CONFIG.depthTest,
      depthWrite: PARTICLE_TRAILS_CONFIG.depthWrite,
    });

    render(<ParticleTrails ships={[createTestShip(1)]} resources={resources} />);

    runLatestFrame(0.5, 0.1);

    expect(resources.geometry.instanceCount).toBeGreaterThanOrEqual(1);
    expect(resources.arrays.spawnTime[0]).toBeCloseTo(0.5, 6);
    expect(resources.arrays.velocity[0]).not.toBe(0);
    expect(Math.abs(resources.arrays.spawnPosition[2])).toBeGreaterThan(0);
  });

  it('updates shader time uniform every frame', () => {
    const resources = createParticleTrailResources(4, {
      size: PARTICLE_TRAILS_CONFIG.size,
      color: PARTICLE_TRAILS_CONFIG.color,
      opacity: PARTICLE_TRAILS_CONFIG.opacity,
      additiveBlending: PARTICLE_TRAILS_CONFIG.additiveBlending,
      depthTest: PARTICLE_TRAILS_CONFIG.depthTest,
      depthWrite: PARTICLE_TRAILS_CONFIG.depthWrite,
    });

    render(<ParticleTrails ships={[createTestShip(0)]} resources={resources} />);

    runLatestFrame(1.0, 0.016);
    const first = resources.material.uniforms.uTime.value as number;
    expect(first).toBeCloseTo(1.0, 6);

    runLatestFrame(1.25, 0.016);
    const second = resources.material.uniforms.uTime.value as number;
    expect(second).toBeGreaterThan(first);
  });
});
