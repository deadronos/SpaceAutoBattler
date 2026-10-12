import { describe, expect, it, beforeEach, vi } from 'vite-plus/test';
import type { Camera, Scene } from 'three';
import type { ColorPipelineConfig, PostprocessingConfig } from '../../../src/config/renderer.js';
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

  const ToneMappingMode = {
    AGX: 'AGX',
    ACES_FILMIC: 'ACES_FILMIC',
    NEUTRAL: 'NEUTRAL',
  } as const;

  class MockToneMappingEffect {
    public static created: MockToneMappingEffect[] = [];
    public static shouldThrow = false;

    constructor(public options: { mode: unknown }) {
      if (MockToneMappingEffect.shouldThrow) {
        throw new Error('headless: no WebGL context');
      }
      MockToneMappingEffect.created.push(this);
    }
  }

  class MockVignetteEffect {
    public static created: MockVignetteEffect[] = [];

    constructor(public options: { offset: number; darkness: number }) {
      MockVignetteEffect.created.push(this);
    }
  }

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
    MockToneMappingEffect,
    MockVignetteEffect,
    MockEffectPass,
    BlendFunction,
    KernelSize,
    ToneMappingMode,
  };
});

vi.mock('postprocessing', async (importOriginal) => {
  const actual = await importOriginal<typeof import('postprocessing')>();
  return {
    ...actual,
    SelectiveBloomEffect: hoisted.MockSelectiveBloomEffect,
    FXAAEffect: hoisted.MockFXAAEffect,
    ToneMappingEffect: hoisted.MockToneMappingEffect,
    VignetteEffect: hoisted.MockVignetteEffect,
    ToneMappingMode: hoisted.ToneMappingMode,
    EffectPass: hoisted.MockEffectPass,
    BlendFunction: hoisted.BlendFunction,
    KernelSize: hoisted.KernelSize,
    Selection: hoisted.MockSelection,
  };
});

import { buildEffects } from '../../../src/components/postprocessing/buildEffects.js';

const baseConfig: PostprocessingConfig = {
  ao: {
    enabled: false,
    halfRes: true,
    quality: 'Medium',
    aoRadius: 4,
    distanceFalloff: 1.0,
    intensity: 5,
    color: '#000000',
    transparencyAware: false,
  },
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
  colorPipeline: {
    enabled: false,
    toneMapping: 'agx',
    exposure: 1,
    bloomScale: 1,
    vignette: { enabled: false, offset: 0.3, darkness: 0.6 },
  },
};

const hdrPipeline: ColorPipelineConfig = {
  enabled: true,
  toneMapping: 'agx',
  exposure: 1,
  bloomScale: 1,
  vignette: { enabled: false, offset: 0.3, darkness: 0.6 },
};

describe('buildEffects', () => {
  beforeEach(() => {
    hoisted.MockSelectiveBloomEffect.created = [];
    hoisted.MockToneMappingEffect.created = [];
    hoisted.MockToneMappingEffect.shouldThrow = false;
    hoisted.MockVignetteEffect.created = [];
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

    const { effectPass, bloomEffects, fxaa, effects, toneMapping, vignette } = buildEffects({
      scene: { id: 'scene' } as unknown as Scene,
      camera: { id: 'camera' } as unknown as Camera,
      bloomContext,
      config: baseConfig,
      colorPipeline: baseConfig.colorPipeline,
    });

    // Legacy path: no tone mapping/vignette effects.
    expect(toneMapping).toBeNull();
    expect(vignette).toBeNull();

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
      colorPipeline: baseConfig.colorPipeline,
    });

    expect(bloomEffects).toHaveLength(0);
    const effectPassInstance = effectPass as unknown as InstanceType<typeof hoisted.MockEffectPass>;
    expect(effectPassInstance.effects).toHaveLength(1);
  });

  it('appends tone mapping immediately before FXAA when the pipeline is enabled', () => {
    const selection = new hoisted.MockSelection(1);
    const bloomContext = {
      defaultGroup: 'default',
      selections: new Map([['default', selection]]),
    } as unknown as BloomContextLike;

    const { effectPass, bloomEffects, fxaa, effects, toneMapping, vignette } = buildEffects({
      scene: {} as Scene,
      camera: {} as Camera,
      bloomContext,
      config: baseConfig,
      colorPipeline: hdrPipeline,
    });

    expect(toneMapping).toBeInstanceOf(hoisted.MockToneMappingEffect);
    expect(vignette).toBeNull();

    const toneMappingInstance = toneMapping as unknown as InstanceType<
      typeof hoisted.MockToneMappingEffect
    >;
    expect(toneMappingInstance.options.mode).toBe(hoisted.ToneMappingMode.AGX);

    // Order: [...bloomEffects, toneMapping, fxaa].
    expect(effects).toEqual([...bloomEffects, toneMapping, fxaa]);
    const effectPassInstance = effectPass as unknown as InstanceType<typeof hoisted.MockEffectPass>;
    expect(effectPassInstance.effects[effectPassInstance.effects.length - 1]).toBe(fxaa);
    expect(effectPassInstance.effects[effectPassInstance.effects.length - 2]).toBe(toneMapping);

    // Task 1 keeps bloom intensities unchanged (`bloomScale: 1`).
    const defaultBloom = bloomEffects[0] as unknown as InstanceType<
      typeof hoisted.MockSelectiveBloomEffect
    >;
    expect(defaultBloom.options.intensity).toBe(0.6);
  });

  it('maps the configured tone-mapping operator and appends the vignette when enabled', () => {
    const { effects, toneMapping, vignette } = buildEffects({
      scene: {} as Scene,
      camera: {} as Camera,
      bloomContext: {
        defaultGroup: 'default',
        selections: new Map(),
      } as unknown as BloomContextLike,
      config: baseConfig,
      colorPipeline: {
        ...hdrPipeline,
        toneMapping: 'aces',
        exposure: 1.4,
        vignette: { enabled: true, offset: 0.35, darkness: 0.5 },
      },
    });

    const toneMappingInstance = toneMapping as unknown as InstanceType<
      typeof hoisted.MockToneMappingEffect
    >;
    expect(toneMappingInstance.options.mode).toBe(hoisted.ToneMappingMode.ACES_FILMIC);

    const vignetteInstance = vignette as unknown as InstanceType<typeof hoisted.MockVignetteEffect>;
    expect(vignetteInstance.options).toEqual({ offset: 0.35, darkness: 0.5 });

    // Order: [...bloomEffects, toneMapping, vignette, fxaa].
    expect(effects).toHaveLength(3);
    expect(effects[effects.length - 1]).toBeInstanceOf(hoisted.MockFXAAEffect);
    expect(effects[effects.length - 2]).toBe(vignette);
    expect(effects[effects.length - 3]).toBe(toneMapping);
  });

  it('degrades to the legacy effect list when tone mapping construction throws', () => {
    hoisted.MockToneMappingEffect.shouldThrow = true;

    const { effects, toneMapping, vignette } = buildEffects({
      scene: {} as Scene,
      camera: {} as Camera,
      bloomContext: {
        defaultGroup: 'default',
        selections: new Map(),
      } as unknown as BloomContextLike,
      config: baseConfig,
      colorPipeline: hdrPipeline,
    });

    expect(toneMapping).toBeNull();
    expect(vignette).toBeNull();
    expect(effects).toHaveLength(1);
    expect(effects[0]).toBeInstanceOf(hoisted.MockFXAAEffect);
  });
});
