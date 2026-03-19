import { describe, expect, it, vi, afterEach } from 'vite-plus/test';
import React from 'react';
import { render, cleanup } from '@testing-library/react';
import type { ShaderMaterial } from 'three';

const frameCallbacks: Array<(state: any, delta: number) => void> = [];

vi.mock('@react-three/fiber', () => ({
  useFrame: (callback: (state: any, delta: number) => void) => {
    frameCallbacks.push(callback);
  },
  useThree: () => ({
    gl: {
      capabilities: {
        getMaxAnisotropy: () => 1,
      },
    },
    viewport: { aspect: 1 },
    size: { width: 800, height: 600 },
    camera: { position: { x: 0, y: 0, z: 100 }, rotation: { z: 0 } },
  }),
}));

vi.mock('@react-three/drei', () => ({
  useTexture: () => ({ organic: undefined, noiseRgba: undefined }),
}));

vi.mock('../../src/game/context.js', () => ({
  useOptionalGameState: () => undefined,
}));

vi.mock('../../src/renderer/BloomProvider.js', () => ({
  useBloomRegistration: () => undefined,
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  frameCallbacks.length = 0;
  delete (globalThis as { __CELESTIAL__?: unknown }).__CELESTIAL__;
});

describe('StarDisk component', () => {
  it('falls back to mesh basic material when shader creation fails', async () => {
    const starMaterialModule = await import('../../src/renderer/starDiskMaterial.js');
    const createSpy = vi
      .spyOn(starMaterialModule, 'createMainSequenceStarMaterial')
      .mockImplementation(() => {
        throw new Error('shader compile failure');
      });

    const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const { StarSphere } = await import('../../src/components/environment/StarSphere.js');

    const config = {
      color: '#ffffff',
      intensity: 1,
      direction: { x: 0, y: 0, z: -1 },
      distance: 1000,
    };

    const { container } = render(
      <StarSphere config={config} enabled={true} size={500} opacity={0.8} distanceMultiplier={1} />,
    );

    expect(container.querySelector('meshbasicmaterial')).not.toBeNull();
    expect(container.querySelector('primitive')).toBeNull();
    expect(consoleWarn).toHaveBeenCalledWith(
      expect.stringContaining('Failed to create main sequence star material'),
      expect.any(Error),
    );

    createSpy.mockRestore();
    consoleWarn.mockRestore();
    consoleError.mockRestore();
  });

  it('updates boundary uniforms when boundary props change', async () => {
    const starMaterialModule = await import('../../src/renderer/starDiskMaterial.js');
    const originalCreate = starMaterialModule.createMainSequenceStarMaterial;
    let createdMaterial: ShaderMaterial | null = null;
    const createSpy = vi
      .spyOn(starMaterialModule, 'createMainSequenceStarMaterial')
      .mockImplementation((options) => {
        const material = originalCreate(options);
        createdMaterial = material;
        return material;
      });
    const updateSpy = vi.spyOn(starMaterialModule, 'updateMainSequenceStarUniforms');

    const { StarSphere } = await import('../../src/components/environment/StarSphere.js');
    const config = {
      color: '#ffffff',
      intensity: 1,
      direction: { x: 0, y: 0, z: -1 },
      distance: 1000,
    };

    const runFrame = () => {
      const callback = frameCallbacks[frameCallbacks.length - 1];
      expect(typeof callback).toBe('function');
      callback?.(
        {
          camera: { position: { x: 0, y: 0, z: 100 }, rotation: { z: 0 } },
          viewport: { aspect: 1 },
          size: { width: 800, height: 600 },
          clock: { getElapsedTime: () => 0 },
        },
        0.016,
      );
    };

    const initialBoundary = { featherStart: 0.9, featherExponent: 2.6, alphaFloor: 0.04 };
    const { rerender } = render(
      <StarSphere
        config={config}
        enabled={true}
        size={500}
        opacity={0.8}
        distanceMultiplier={1}
        boundary={initialBoundary}
      />,
    );

    runFrame();

    expect(createdMaterial).not.toBeNull();
    const uniforms = createdMaterial!.uniforms as {
      iBoundaryFeather: { value: { x: number; y: number; z: number } };
    };
    expect(uniforms.iBoundaryFeather.value.x).toBeCloseTo(0.9, 2);
    expect(uniforms.iBoundaryFeather.value.y).toBeCloseTo(2.6, 2);
    expect(uniforms.iBoundaryFeather.value.z).toBeCloseTo(0.04, 2);
    expect(updateSpy).toHaveBeenCalled();

    rerender(
      <StarSphere
        config={config}
        enabled={true}
        size={500}
        opacity={0.8}
        distanceMultiplier={1}
        boundary={{ featherStart: 0.82, featherExponent: 4.2, alphaFloor: 0.02 }}
      />,
    );

    runFrame();

    expect(uniforms.iBoundaryFeather.value.x).toBeCloseTo(0.82, 2);
    expect(uniforms.iBoundaryFeather.value.y).toBeCloseTo(4.2, 2);
    expect(uniforms.iBoundaryFeather.value.z).toBeCloseTo(0.02, 2);

    rerender(
      <StarSphere
        config={config}
        enabled={true}
        size={500}
        opacity={0.8}
        distanceMultiplier={1}
        boundary={undefined}
      />,
    );

    runFrame();

    expect(uniforms.iBoundaryFeather.value.x).toBeCloseTo(0.875, 2);
    expect(uniforms.iBoundaryFeather.value.y).toBeCloseTo(1.75, 2);
    expect(uniforms.iBoundaryFeather.value.z).toBeCloseTo(0.05, 3);

    createSpy.mockRestore();
    updateSpy.mockRestore();
  });
});
