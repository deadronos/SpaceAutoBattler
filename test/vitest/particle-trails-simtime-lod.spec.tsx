import { describe, it, expect, afterEach, vi } from 'vite-plus/test';
import React from 'react';
import { render, cleanup } from '@testing-library/react';
import { Vector3, Quaternion, Matrix4 } from 'three';
import type { GameState, ShipEntity } from '../../src/types/index.js';
import { ParticleTrails } from '../../src/components/ParticleTrails.js';
import { PARTICLE_TRAILS_CONFIG } from '../../src/config/effects.js';
import { DEFAULT_DISTANCE_THRESHOLD } from '../../src/components/lod/shipLodPartition.js';
import { computeTrailLodFactor } from '../../src/hooks/useParticleTrailSimulation.js';
import {
  createParticleTrailResources,
  TRAIL_LOD_FADE_END,
  TRAIL_LOD_FADE_START,
} from '../../src/renderer/particles/trailResources.js';

const frameCallbacks: Array<
  (state: { clock: { getElapsedTime: () => number } }, delta: number) => void
> = [];

const mockCamera = {
  position: new Vector3(0, 0, 50),
  projectionMatrix: new Matrix4().makePerspective(-1, 1, 1, -1, 0.1, 10000),
  matrixWorldInverse: new Matrix4().makeTranslation(0, 0, -50),
};

const gameStateHolder = vi.hoisted(() => ({
  current: null as Partial<GameState> | null,
}));

vi.mock('@react-three/fiber', () => ({
  useFrame: (
    callback: (state: { clock: { getElapsedTime: () => number } }, delta: number) => void,
  ) => {
    frameCallbacks.push(callback);
  },
  useThree: (selector: (s: unknown) => unknown) => selector({ camera: mockCamera }),
}));

vi.mock('@react-three/drei', () => ({
  useGLTF: Object.assign(() => ({ scene: null }), { setDecoderPath: vi.fn() }),
}));

vi.mock('../../src/app/context.js', () => ({
  useNullableGameState: () => gameStateHolder.current,
}));

afterEach(() => {
  cleanup();
  frameCallbacks.length = 0;
  gameStateHolder.current = null;
  mockCamera.position.set(0, 0, 50);
  vi.clearAllMocks();
});

function createShip(x = 0): ShipEntity {
  return {
    id: 1,
    transform: {
      position: new Vector3(x, 0, 0),
      rotation: new Quaternion(),
      scale: 1,
    },
    rigidBody: {} as never,
    collider: {} as never,
    ship: {
      team: 'blue',
      hull: 'fighter',
      hp: 100,
      maxHp: 100,
      shield: 0,
      maxShield: 0,
      cooldown: 0,
      fireRate: 1,
      damage: 10,
      projectileSpeed: 100,
      range: 100,
      speed: 20,
      xp: 0,
      level: 1,
      xpToNext: 100,
      damageType: 'kinetic',
      levelBonuses: {} as never,
      subsystems: {} as never,
      armor: 0,
      velocity: new Vector3(0, 0, 10),
      angularVelocity: new Vector3(),
      motion: {
        mass: 1,
        maxSpeed: 50,
        linearAcceleration: 20,
        linearDamping: 0.5,
        maxTurnRate: 2,
        angularAcceleration: 2,
        angularDamping: 0.5,
      },
    } as unknown as ShipEntity['ship'],
    model: 'fighter',
    ai: { command: { thrust: 1 } } as ShipEntity['ai'],
  } as unknown as ShipEntity;
}

describe('Particle trail sim-time sync and LOD fade', () => {
  it('aligns trail LOD fade bounds with ship LOD threshold', () => {
    expect(TRAIL_LOD_FADE_END).toBe(DEFAULT_DISTANCE_THRESHOLD);
    expect(TRAIL_LOD_FADE_START).toBeLessThan(TRAIL_LOD_FADE_END);

    expect(computeTrailLodFactor(0)).toBe(1);
    expect(computeTrailLodFactor(TRAIL_LOD_FADE_START * TRAIL_LOD_FADE_START)).toBe(1);

    const mid = (TRAIL_LOD_FADE_START + TRAIL_LOD_FADE_END) / 2;
    const midFactor = computeTrailLodFactor(mid * mid);
    expect(midFactor).toBeGreaterThan(0);
    expect(midFactor).toBeLessThan(1);

    expect(computeTrailLodFactor(TRAIL_LOD_FADE_END * TRAIL_LOD_FADE_END)).toBe(0);
    expect(computeTrailLodFactor((TRAIL_LOD_FADE_END + 500) ** 2)).toBe(0);
  });

  it('wires uLodFadeStart and uLodFadeEnd into trail shader resources', () => {
    const res = createParticleTrailResources(16, PARTICLE_TRAILS_CONFIG);
    expect(res.material.uniforms.uLodFadeStart?.value).toBe(TRAIL_LOD_FADE_START);
    expect(res.material.uniforms.uLodFadeEnd?.value).toBe(TRAIL_LOD_FADE_END);
    expect(res.material.vertexShader).toContain('lodFade');
    expect(res.material.vertexShader).toContain('uLodFadeStart');
    expect(res.material.vertexShader).toContain('uLodFadeEnd');
    res.geometry.dispose();
    res.material.dispose();
  });

  it('drives uTime from simulation time, honors pause/timeScale, and resets cleanly', () => {
    const simState = {
      time: 10,
      timeScale: 1,
      paused: false,
      simulation: {
        step: 0.05,
        accumulator: 0,
        alpha: 0.5,
        lastTickDuration: 0,
        lastTickIterations: 1,
        maxSubSteps: 4,
        profileSubsystems: false,
        profileSampleRate: 1,
        enableSubsystemGuards: true,
      },
    };
    gameStateHolder.current = simState;

    const resources = createParticleTrailResources(32, PARTICLE_TRAILS_CONFIG);
    const ships = [createShip(0)];
    render(<ParticleTrails ships={ships} resources={resources} />);
    const callback = frameCallbacks[0];
    expect(typeof callback).toBe('function');

    // Frame 1: simTime = 10 + 0.5 * 0.05 = 10.025 (clock elapsed time is deliberately different)
    callback({ clock: { getElapsedTime: () => 999 } }, 0.016);
    expect(resources.material.uniforms.uTime.value).toBeCloseTo(10.025, 6);

    // Advance sim time by 0.25s while wall-clock jumps arbitrarily
    simState.time = 10.25;
    simState.simulation.alpha = 0;
    callback({ clock: { getElapsedTime: () => 5000 } }, 0.016);
    expect(resources.material.uniforms.uTime.value).toBeCloseTo(10.25, 6);

    // Paused: uTime stays frozen even if simTime advances or clock changes
    simState.paused = true;
    simState.time = 15;
    callback({ clock: { getElapsedTime: () => 8000 } }, 0.016);
    expect(resources.material.uniforms.uTime.value).toBeCloseTo(10.25, 6);

    // Unpause + match reset (simTime jumps backwards): re-syncs cleanly
    simState.paused = false;
    simState.time = 0.2;
    callback({ clock: { getElapsedTime: () => 9000 } }, 0.016);
    expect(resources.material.uniforms.uTime.value).toBeCloseTo(0.2, 6);
    resources.geometry.dispose();
    resources.material.dispose();
  });

  it('keeps spawning beyond 500 units up to ship LOD fade range', () => {
    const simState = {
      time: 0,
      timeScale: 1,
      paused: false,
      simulation: {
        step: 0.05,
        accumulator: 0,
        alpha: 0,
        lastTickDuration: 0,
        lastTickIterations: 1,
        maxSubSteps: 4,
        profileSubsystems: false,
        profileSampleRate: 1,
        enableSubsystemGuards: true,
      },
    };
    gameStateHolder.current = simState;

    // 1500 units down -Z in front of camera: beyond old 500-unit cutoff, inside 4000-unit LOD range.
    mockCamera.position.set(0, 0, 0);
    const resources = createParticleTrailResources(32, PARTICLE_TRAILS_CONFIG);
    const ship = createShip(0);
    ship.transform.position.set(0, 0, -1500);
    const ships = [ship];
    render(<ParticleTrails ships={ships} resources={resources} />);
    const callback = frameCallbacks[0];

    simState.time = 0.05;
    callback({ clock: { getElapsedTime: () => 0.05 } }, 0.05);
    simState.time = 0.15;
    callback({ clock: { getElapsedTime: () => 0.15 } }, 0.1);

    expect(resources.geometry.instanceCount).toBeGreaterThan(0);
    resources.geometry.dispose();
    resources.material.dispose();
  });
});
