import { describe, expect, it, beforeEach, vi } from 'vitest';
import type { Camera, Scene } from 'three';
import type { PostprocessingConfig } from '../../../src/config/renderer.js';
import type { BloomContextLike } from '../../../src/components/postprocessing/buildEffects.js';

const hoisted = vi.hoisted(() => {
  class MockSelection {
    constructor(public size: number) {}
  }

  const BlendFunction = { SCREEN: 'SCREEN' } as const;
  const KernelSize = { SMALL: 'SMALL' } as const;

  class MockSelectiveBloomEffect {
    public selection: InstanceType<typeof MockSelection> | null = null;
    public ignoreBackground = false;
    public blendMode = { opacity: { value: 0 } };
    public depthMaskMaterial = { keepFar: true };
    public luminanceMaterial = { threshold: 0, smoothing: 0 };
    public mipmapBlur = false;
    public static created: MockSelectiveBloomEffect[] = [];

    constructor(
      public scene: Scene,
      public camera: Camera,
      public options: { blendFunction: unknown; kernelSize: unknown; intensity: number },
    ) {
      MockSelectiveBloomEffect.created.push(this);
    }
  }

  class MockFXAAEffect {}

  class MockEffectPass {
    public renderToScreen = false;
    public effects: unknown[];

    constructor(
      public camera: Camera,
      ...effects: unknown[]
    ) {
      this.effects = effects;
    }
  }

  return {
    MockSelection,
    MockSelectiveBloomEffect,
    MockFXAAEffect,
    MockEffectPass,
    BlendFunction,
    KernelSize,
  };
});

vi.mock('postprocessing', async (importOriginal) => {
  const actual = await importOriginal<typeof import('postprocessing')>();
  return {
    ...actual,
    SelectiveBloomEffect: hoisted.MockSelectiveBloomEffect,
    FXAAEffect: hoisted.MockFXAAEffect,
    EffectPass: hoisted.MockEffectPass,
    BlendFunction: hoisted.BlendFunction,
    KernelSize: hoisted.KernelSize,
    Selection: hoisted.MockSelection,
  };
});

import { buildEffects } from '../../../src/components/postprocessing/buildEffects.js';

const baseConfig: PostprocessingConfig = {
  bloomThreshold: 0.5,
  bloomSmoothing: 0.2,
  bloomIntensity: 0.8,
  bloomIgnoreBackground: true,
  bloomDefaultGroup: 'default',
  bloomLayerStart: 10,
  bloomGroups: {
    default: { intensity: 0.6, threshold: 0.9, smoothing: 0.3 },
    engines: { intensity: 1.2, threshold: 1.5, smoothing: 0.4 },
  },
};

describe('buildEffects', () => {
  beforeEach(() => {
    hoisted.MockSelectiveBloomEffect.created = [];
  });

  it('creates bloom effects for selections and applies config overrides', () => {
    const selection = new hoisted.MockSelection(3);
    const enginesSelection = new hoisted.MockSelection(0);
    const bloomContext = {
      defaultGroup: 'default',
      selections: new Map([
        ['default', selection],
        ['engines', enginesSelection],
      ]),
    } as unknown as BloomContextLike;

    const { effectPass, bloomEffects, fxaa, effects } = buildEffects({
      scene: { id: 'scene' } as unknown as Scene,
      camera: { id: 'camera' } as unknown as Camera,
      bloomContext,
      config: baseConfig,
    });

    expect(fxaa).toBeInstanceOf(hoisted.MockFXAAEffect);
    expect(effectPass).toBeInstanceOf(hoisted.MockEffectPass);
    const effectPassInstance = effectPass as unknown as InstanceType<typeof hoisted.MockEffectPass>;
    expect(effectPassInstance.effects).toHaveLength(3);
    expect(effectPassInstance.renderToScreen).toBe(true);

    expect(bloomEffects).toHaveLength(2);
    const defaultBloom = bloomEffects[0] as unknown as InstanceType<
      typeof hoisted.MockSelectiveBloomEffect
    >;
    expect(defaultBloom.options.intensity).toBe(0.6);
    expect(defaultBloom.ignoreBackground).toBe(true);
    expect(defaultBloom.blendMode.opacity.value).toBe(1);
    expect(defaultBloom.depthMaskMaterial.keepFar).toBe(false);
    expect(defaultBloom.luminanceMaterial.threshold).toBe(0.9);
    expect(defaultBloom.luminanceMaterial.smoothing).toBe(0.3);
    expect(defaultBloom.mipmapBlur).toBe(true);

    const enginesBloom = bloomEffects[1] as unknown as InstanceType<
      typeof hoisted.MockSelectiveBloomEffect
    >;
    enginesSelection.size = 0;
    expect(enginesBloom.blendMode.opacity.value).toBe(0);

    expect(effects).toEqual([...bloomEffects, fxaa]);
  });

  it('returns fxaa-only pass when no selections available', () => {
    const bloomContext = {
      defaultGroup: 'default',
      selections: new Map(),
    } as unknown as BloomContextLike;

    const { bloomEffects, effectPass } = buildEffects({
      scene: {} as Scene,
      camera: {} as Camera,
      bloomContext,
      config: baseConfig,
    });

    expect(bloomEffects).toHaveLength(0);
    const effectPassInstance = effectPass as unknown as InstanceType<typeof hoisted.MockEffectPass>;
    expect(effectPassInstance.effects).toHaveLength(1);
  });
});
