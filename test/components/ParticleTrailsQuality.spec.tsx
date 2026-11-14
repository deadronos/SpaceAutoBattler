import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test';
import { act, cleanup, render } from '@testing-library/react';
import { Matrix4, Quaternion, Vector3 } from 'three';
import type { ShipEntity } from '../../src/types/index.js';
import { useUiStore } from '../../src/app/uiStore.js';
import { QUALITY_PRESETS } from '../../src/config/quality.js';
import * as trailResourcesModule from '../../src/renderer/particles/trailResources.js';
import type { ParticleTrailResources } from '../../src/renderer/particles/trailResources.js';

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
  useThree: (selector: (s: { camera: typeof mockCamera }) => unknown) =>
    selector({ camera: mockCamera }),
}));

vi.mock('@react-three/drei', () => ({
  useGLTF: Object.assign(() => ({ scene: null }), { setDecoderPath: vi.fn() }),
}));

vi.mock('../../src/hooks/usePrefersReducedMotion.js', () => ({
  usePrefersReducedMotion: () => false,
}));

import { ParticleTrails } from '../../src/components/ParticleTrails.js';

function createTestShip(id: number, thrust: number): ShipEntity {
  return {
    id,
    transform: {
      position: new Vector3(),
      rotation: new Quaternion(),
      scale: 1,
    },
    ship: {
      team: 'blue',
      hull: 'fighter',
    },
    ai: { command: { thrust } },
  } as unknown as ShipEntity;
}

const DEFAULT_SNAPSHOT = (() => {
  const s = useUiStore.getState();
  return {
    qualityPreset: s.qualityPreset,
    detectedQualityTier: s.detectedQualityTier,
    paused: s.paused,
  };
})();

describe('ParticleTrails quality resize without remount', () => {
  beforeEach(() => {
    frameCallbacks.length = 0;
    useUiStore.setState({ qualityPreset: 'high', detectedQualityTier: 'high', paused: false });
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    useUiStore.setState(DEFAULT_SNAPSHOT);
    frameCallbacks.length = 0;
  });

  it('reallocates particle buffers and resets instance count when quality tier drops without remounting', async () => {
    const created: ParticleTrailResources[] = [];
    const origCreate = trailResourcesModule.createParticleTrailResources;
    vi.spyOn(trailResourcesModule, 'createParticleTrailResources').mockImplementation(
      (maxParticles, options) => {
        const res = origCreate(maxParticles, options);
        created.push(res);
        return res;
      },
    );

    render(<ParticleTrails ships={[createTestShip(1, 1)]} />);
    expect(created).toHaveLength(1);
    const highResources = created[0];
    expect(highResources.arrays.spawnTime.length).toBe(QUALITY_PRESETS.high.particles.maxParticles);

    const runFrame = (time: number, delta: number) => {
      const cb = frameCallbacks[frameCallbacks.length - 1];
      cb?.({ clock: { getElapsedTime: () => time } }, delta);
    };

    runFrame(0.5, 0.5);
    runFrame(1.0, 0.5);
    expect(highResources.geometry.instanceCount).toBeGreaterThan(0);

    await act(async () => {
      useUiStore.setState({ qualityPreset: 'low' });
    });

    expect(created).toHaveLength(2);
    const lowResources = created[1];
    expect(lowResources.arrays.spawnTime.length).toBe(QUALITY_PRESETS.low.particles.maxParticles);
    expect(lowResources.geometry.instanceCount).toBe(0);

    runFrame(1.5, 0.5);
    expect(lowResources.geometry.instanceCount).toBeGreaterThan(0);
    expect(lowResources.geometry.instanceCount).toBeLessThanOrEqual(
      QUALITY_PRESETS.low.particles.maxParticles,
    );
  });
});
