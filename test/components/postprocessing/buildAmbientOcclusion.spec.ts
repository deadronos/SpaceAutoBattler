import { describe, expect, it, beforeEach, vi } from 'vite-plus/test';
import { Color, type Camera, type Scene } from 'three';
import type { AmbientOcclusionConfig } from '../../../src/config/renderer.js';

interface MockPassInstance {
  scene: unknown;
  camera: unknown;
  width: number;
  height: number;
  configuration: {
    halfRes: boolean;
    aoRadius: number;
    distanceFalloff: number;
    intensity: number;
    color: unknown;
    transparencyAware: boolean;
  };
  setQualityMode: (mode: string) => void;
  dispose: () => void;
}

const hoisted = vi.hoisted(() => {
  const instances: MockPassInstance[] = [];
  const state = { shouldThrow: false };

  class MockN8AOPostPass {
    public configuration = {
      halfRes: false,
      aoRadius: 5,
      distanceFalloff: 1,
      intensity: 5,
      color: null,
      transparencyAware: false,
    };
    public setQualityMode = vi.fn();
    public dispose = vi.fn();

    constructor(
      public scene: unknown,
      public camera: unknown,
      public width: number,
      public height: number,
    ) {
      if (state.shouldThrow) {
        throw new Error('no WebGL context');
      }
      (instances as unknown[]).push(this);
    }
  }

  return { instances, state, MockN8AOPostPass };
});

vi.mock('n8ao', () => ({
  N8AOPostPass: hoisted.MockN8AOPostPass,
}));

import { buildAmbientOcclusion } from '../../../src/components/postprocessing/buildAmbientOcclusion.js';

const baseConfig: AmbientOcclusionConfig = {
  enabled: true,
  halfRes: true,
  quality: 'Medium',
  aoRadius: 4,
  distanceFalloff: 1.0,
  intensity: 5,
  color: '#000000',
  transparencyAware: false,
};

const scene = { id: 'scene' } as unknown as Scene;
const camera = { id: 'camera' } as unknown as Camera;

describe('buildAmbientOcclusion', () => {
  beforeEach(() => {
    hoisted.instances.length = 0;
    hoisted.state.shouldThrow = false;
  });

  it('returns null when AO is disabled without constructing a pass', () => {
    const result = buildAmbientOcclusion({
      scene,
      camera,
      width: 800,
      height: 600,
      config: { ...baseConfig, enabled: false },
    });

    expect(result).toBeNull();
    expect(hoisted.instances).toHaveLength(0);
  });

  it('constructs and configures the pass when AO is enabled', () => {
    const result = buildAmbientOcclusion({
      scene,
      camera,
      width: 800,
      height: 600,
      config: baseConfig,
    });

    expect(result).not.toBeNull();
    expect(hoisted.instances).toHaveLength(1);

    const pass = hoisted.instances[0]!;
    expect(pass.scene).toBe(scene);
    expect(pass.camera).toBe(camera);
    expect(pass.width).toBe(800);
    expect(pass.height).toBe(600);

    expect(pass.setQualityMode).toHaveBeenCalledWith('Medium');
    expect(pass.configuration.halfRes).toBe(true);
    expect(pass.configuration.aoRadius).toBe(4);
    expect(pass.configuration.distanceFalloff).toBe(1.0);
    expect(pass.configuration.intensity).toBe(5);
    expect(pass.configuration.color).toBeInstanceOf(Color);
    expect((pass.configuration.color as Color).getHex()).toBe(0x000000);
    expect(pass.configuration.transparencyAware).toBe(false);
  });

  it('honors an explicit transparencyAware setting', () => {
    buildAmbientOcclusion({
      scene,
      camera,
      width: 800,
      height: 600,
      config: { ...baseConfig, transparencyAware: true },
    });

    expect(hoisted.instances[0]!.configuration.transparencyAware).toBe(true);
  });

  it('falls back to transparencyAware = false when the knob is omitted', () => {
    const { transparencyAware: _omitted, ...configWithoutKnob } = baseConfig;

    buildAmbientOcclusion({
      scene,
      camera,
      width: 800,
      height: 600,
      config: configWithoutKnob,
    });

    expect(hoisted.instances[0]!.configuration.transparencyAware).toBe(false);
  });

  it('returns null and does not throw when construction fails', () => {
    hoisted.state.shouldThrow = true;

    expect(() =>
      buildAmbientOcclusion({
        scene,
        camera,
        width: 800,
        height: 600,
        config: baseConfig,
      }),
    ).not.toThrow();

    const result = buildAmbientOcclusion({
      scene,
      camera,
      width: 800,
      height: 600,
      config: baseConfig,
    });

    expect(result).toBeNull();
    expect(hoisted.instances).toHaveLength(0);
  });
});
