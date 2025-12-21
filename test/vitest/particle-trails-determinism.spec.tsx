import { describe, it, expect, afterEach, vi, beforeEach } from 'vitest';
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

beforeEach(() => {
  frameCallbacks.length = 0;
});

afterEach(() => {
  cleanup();
  frameCallbacks.length = 0;
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

function runLatestFrame(time: number, delta: number): void {
  const callback = frameCallbacks[frameCallbacks.length - 1];
  expect(typeof callback).toBe('function');
  callback?.({ clock: { getElapsedTime: () => time } }, delta);
}

describe('ParticleTrails Determinism', () => {
  it('produces identical particle data across multiple runs with same seed', () => {
    // Create two independent resource sets
    const resources1 = createParticleTrailResources(32, {
      size: PARTICLE_TRAILS_CONFIG.size,
      color: PARTICLE_TRAILS_CONFIG.color,
      opacity: PARTICLE_TRAILS_CONFIG.opacity,
      additiveBlending: PARTICLE_TRAILS_CONFIG.additiveBlending,
      depthTest: PARTICLE_TRAILS_CONFIG.depthTest,
      depthWrite: PARTICLE_TRAILS_CONFIG.depthWrite,
    });

    const resources2 = createParticleTrailResources(32, {
      size: PARTICLE_TRAILS_CONFIG.size,
      color: PARTICLE_TRAILS_CONFIG.color,
      opacity: PARTICLE_TRAILS_CONFIG.opacity,
      additiveBlending: PARTICLE_TRAILS_CONFIG.additiveBlending,
      depthTest: PARTICLE_TRAILS_CONFIG.depthTest,
      depthWrite: PARTICLE_TRAILS_CONFIG.depthWrite,
    });

    // First run
    const { unmount: unmount1 } = render(
      <ParticleTrails ships={[createTestShip(1, 1)]} resources={resources1} />,
    );

    runLatestFrame(0.5, 0.1);
    const snapshot1 = {
      spawnPosition: Array.from(resources1.arrays.spawnPosition.slice(0, 9)),
      velocity: Array.from(resources1.arrays.velocity.slice(0, 9)),
      lifetime: Array.from(resources1.arrays.lifetime.slice(0, 3)),
      scale: Array.from(resources1.arrays.scale.slice(0, 3)),
    };

    unmount1();
    cleanup();
    frameCallbacks.length = 0;

    // Second run - should produce identical results
    render(<ParticleTrails ships={[createTestShip(1, 1)]} resources={resources2} />);

    runLatestFrame(0.5, 0.1);
    const snapshot2 = {
      spawnPosition: Array.from(resources2.arrays.spawnPosition.slice(0, 9)),
      velocity: Array.from(resources2.arrays.velocity.slice(0, 9)),
      lifetime: Array.from(resources2.arrays.lifetime.slice(0, 3)),
      scale: Array.from(resources2.arrays.scale.slice(0, 3)),
    };

    // Verify determinism - all arrays should match exactly
    expect(snapshot1.spawnPosition).toEqual(snapshot2.spawnPosition);
    expect(snapshot1.velocity).toEqual(snapshot2.velocity);
    expect(snapshot1.lifetime).toEqual(snapshot2.lifetime);
    expect(snapshot1.scale).toEqual(snapshot2.scale);
  });

  it('produces consistent results across multiple frames', () => {
    const resources = createParticleTrailResources(64, {
      size: PARTICLE_TRAILS_CONFIG.size,
      color: PARTICLE_TRAILS_CONFIG.color,
      opacity: PARTICLE_TRAILS_CONFIG.opacity,
      additiveBlending: PARTICLE_TRAILS_CONFIG.additiveBlending,
      depthTest: PARTICLE_TRAILS_CONFIG.depthTest,
      depthWrite: PARTICLE_TRAILS_CONFIG.depthWrite,
    });

    render(<ParticleTrails ships={[createTestShip(1, 1)]} resources={resources} />);

    // Run first frame
    runLatestFrame(0.0, 0.016);
    const firstParticleVelocity = [
      resources.arrays.velocity[0],
      resources.arrays.velocity[1],
      resources.arrays.velocity[2],
    ];

    // Run second frame
    runLatestFrame(0.016, 0.016);

    // The first particle should remain unchanged (not overwritten)
    // New particles should be added at different indices
    expect(resources.arrays.velocity[0]).toBe(firstParticleVelocity[0]);
    expect(resources.arrays.velocity[1]).toBe(firstParticleVelocity[1]);
    expect(resources.arrays.velocity[2]).toBe(firstParticleVelocity[2]);
  });

  it('produces different results for different ships at different positions', () => {
    const resources1 = createParticleTrailResources(32, {
      size: PARTICLE_TRAILS_CONFIG.size,
      color: PARTICLE_TRAILS_CONFIG.color,
      opacity: PARTICLE_TRAILS_CONFIG.opacity,
      additiveBlending: PARTICLE_TRAILS_CONFIG.additiveBlending,
      depthTest: PARTICLE_TRAILS_CONFIG.depthTest,
      depthWrite: PARTICLE_TRAILS_CONFIG.depthWrite,
    });

    const resources2 = createParticleTrailResources(32, {
      size: PARTICLE_TRAILS_CONFIG.size,
      color: PARTICLE_TRAILS_CONFIG.color,
      opacity: PARTICLE_TRAILS_CONFIG.opacity,
      additiveBlending: PARTICLE_TRAILS_CONFIG.additiveBlending,
      depthTest: PARTICLE_TRAILS_CONFIG.depthTest,
      depthWrite: PARTICLE_TRAILS_CONFIG.depthWrite,
    });

    // First ship at origin
    const { unmount: unmount1 } = render(
      <ParticleTrails
        ships={[createTestShip(1, 1, new Vector3(0, 0, 0))]}
        resources={resources1}
      />,
    );

    runLatestFrame(0.5, 0.1);
    const spawn1 = [
      resources1.arrays.spawnPosition[0],
      resources1.arrays.spawnPosition[1],
      resources1.arrays.spawnPosition[2],
    ];

    unmount1();
    cleanup();
    frameCallbacks.length = 0;

    // Second ship at different position
    render(
      <ParticleTrails
        ships={[createTestShip(1, 1, new Vector3(10, 5, 3))]}
        resources={resources2}
      />,
    );

    runLatestFrame(0.5, 0.1);
    const spawn2 = [
      resources2.arrays.spawnPosition[0],
      resources2.arrays.spawnPosition[1],
      resources2.arrays.spawnPosition[2],
    ];

    // Spawn positions should differ based on ship position
    expect(spawn1).not.toEqual(spawn2);
    expect(Math.abs(spawn1[0] - spawn2[0])).toBeGreaterThan(5);
  });

  it('uses seeded RNG for all random values', () => {
    const resources = createParticleTrailResources(32, {
      size: PARTICLE_TRAILS_CONFIG.size,
      color: PARTICLE_TRAILS_CONFIG.color,
      opacity: PARTICLE_TRAILS_CONFIG.opacity,
      additiveBlending: PARTICLE_TRAILS_CONFIG.additiveBlending,
      depthTest: PARTICLE_TRAILS_CONFIG.depthTest,
      depthWrite: PARTICLE_TRAILS_CONFIG.depthWrite,
    });

    render(<ParticleTrails ships={[createTestShip(1, 1)]} resources={resources} />);

    runLatestFrame(0.5, 0.1);

    // Check that random values are within expected ranges and not zero
    // This validates that RNG is being used for jitter and scale
    const velocity = resources.arrays.velocity;
    const scale = resources.arrays.scale;
    const lifetime = resources.arrays.lifetime;

    // At least one particle should be spawned
    expect(resources.geometry.instanceCount).toBeGreaterThan(0);

    // Velocity should have jitter (not exactly backward vector)
    const hasJitter = velocity[0] !== 0 || velocity[1] !== 0 || velocity[2] !== 0;
    expect(hasJitter).toBe(true);

    // Scale should have variation (from RNG)
    expect(scale[0]).toBeGreaterThan(0);
    expect(scale[0]).toBeLessThanOrEqual(1 + PARTICLE_TRAILS_CONFIG.scaleJitter * 2);

    // Lifetime should have variation (from RNG)
    expect(lifetime[0]).toBeGreaterThan(0);
    expect(lifetime[0]).toBeLessThanOrEqual(
      PARTICLE_TRAILS_CONFIG.lifetime * (1 + PARTICLE_TRAILS_CONFIG.scaleJitter * 2),
    );
  });

  it('maintains determinism with multiple ships', () => {
    const resources1 = createParticleTrailResources(64, {
      size: PARTICLE_TRAILS_CONFIG.size,
      color: PARTICLE_TRAILS_CONFIG.color,
      opacity: PARTICLE_TRAILS_CONFIG.opacity,
      additiveBlending: PARTICLE_TRAILS_CONFIG.additiveBlending,
      depthTest: PARTICLE_TRAILS_CONFIG.depthTest,
      depthWrite: PARTICLE_TRAILS_CONFIG.depthWrite,
    });

    const resources2 = createParticleTrailResources(64, {
      size: PARTICLE_TRAILS_CONFIG.size,
      color: PARTICLE_TRAILS_CONFIG.color,
      opacity: PARTICLE_TRAILS_CONFIG.opacity,
      additiveBlending: PARTICLE_TRAILS_CONFIG.additiveBlending,
      depthTest: PARTICLE_TRAILS_CONFIG.depthTest,
      depthWrite: PARTICLE_TRAILS_CONFIG.depthWrite,
    });

    const ships = [
      createTestShip(1, 1, new Vector3(0, 0, 0)),
      createTestShip(2, 0.8, new Vector3(5, 0, 0)),
      createTestShip(3, 1, new Vector3(-5, 0, 0)),
    ];

    // First run
    const { unmount: unmount1 } = render(<ParticleTrails ships={ships} resources={resources1} />);

    runLatestFrame(0.5, 0.1);
    const snapshot1 = {
      velocity: Array.from(resources1.arrays.velocity.slice(0, 18)),
      scale: Array.from(resources1.arrays.scale.slice(0, 6)),
      instanceCount: resources1.geometry.instanceCount,
    };

    unmount1();
    cleanup();
    frameCallbacks.length = 0;

    // Second run with same ships
    render(<ParticleTrails ships={ships} resources={resources2} />);

    runLatestFrame(0.5, 0.1);
    const snapshot2 = {
      velocity: Array.from(resources2.arrays.velocity.slice(0, 18)),
      scale: Array.from(resources2.arrays.scale.slice(0, 6)),
      instanceCount: resources2.geometry.instanceCount,
    };

    // Should be deterministic even with multiple ships
    expect(snapshot1.velocity).toEqual(snapshot2.velocity);
    expect(snapshot1.scale).toEqual(snapshot2.scale);
    expect(snapshot1.instanceCount).toBe(snapshot2.instanceCount);
  });
});
