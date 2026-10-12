import { describe, expect, it, beforeEach, vi } from 'vite-plus/test';
import { LinearSRGBColorSpace, NoColorSpace, NoToneMapping, SRGBColorSpace, Vector2 } from 'three';
import type { Camera, Scene, WebGLRenderer } from 'three';
import type { EffectPass, Pass } from 'postprocessing';
import type { ColorPipelineConfig } from '../../../src/config/renderer.js';

const hoisted = vi.hoisted(() => {
  const mockComposerDispose = vi.fn();

  class MockEffectComposer {
    public passes: unknown[] = [];
    public dispose = mockComposerDispose;
    public setSize = vi.fn();

    constructor(
      public renderer: unknown,
      public renderTarget: unknown,
    ) {}

    addPass(pass: unknown): void {
      this.passes.push(pass);
    }
  }

  class MockRenderPass {
    constructor(
      public scene: unknown,
      public camera: unknown,
    ) {}
  }

  return { MockEffectComposer, MockRenderPass, mockComposerDispose };
});

vi.mock('postprocessing', async (importOriginal) => {
  const actual = await importOriginal<typeof import('postprocessing')>();
  return {
    ...actual,
    EffectComposer: hoisted.MockEffectComposer,
    RenderPass: hoisted.MockRenderPass,
  };
});

import { createComposer } from '../../../src/components/postprocessing/createComposer.js';

const hdrPipeline: ColorPipelineConfig = {
  enabled: true,
  toneMapping: 'agx',
  exposure: 1,
  bloomScale: 1,
  vignette: { enabled: false, offset: 0.3, darkness: 0.6 },
};

const legacyPipeline: ColorPipelineConfig = { ...hdrPipeline, enabled: false };

describe('createComposer', () => {
  beforeEach(() => {
    hoisted.mockComposerDispose.mockClear();
  });

  it('configures renderer state and wires passes', () => {
    const renderer = {
      autoClear: true,
      toneMapping: NoToneMapping,
      toneMappingExposure: 2,
      outputColorSpace: LinearSRGBColorSpace,
      getPixelRatio: vi.fn(() => 1.5),
      getSize: vi.fn((target: Vector2) => target.set(800, 600)),
    } as unknown as WebGLRenderer;

    const scene = { id: 'scene' } as unknown as Scene;
    const camera = { id: 'camera' } as unknown as Camera;
    const effectPass = { id: 'effectPass' } as unknown as EffectPass;

    const result = createComposer({
      renderer,
      scene,
      camera,
      effectPass,
      colorPipeline: hdrPipeline,
    });

    expect(renderer.autoClear).toBe(false);
    expect(renderer.outputColorSpace).toBe(SRGBColorSpace);
    expect(renderer.toneMapping).toBe(NoToneMapping);
    expect(renderer.toneMappingExposure).toBe(1);

    const composer = result.composer as unknown as InstanceType<typeof hoisted.MockEffectComposer>;
    // Enabled pipeline renders into a linear HDR target.
    expect((composer.renderTarget as any).texture.colorSpace).toBe(NoColorSpace);
    expect(composer.passes).toHaveLength(2);
    expect(composer.passes[1]).toBe(effectPass);
    expect(result.renderTarget.width).toBeCloseTo(1200);
    expect(result.renderTarget.height).toBeCloseTo(900);

    result.restoreRendererState();
    expect(renderer.autoClear).toBe(true);
    expect(renderer.outputColorSpace).toBe(LinearSRGBColorSpace);
    expect(renderer.toneMappingExposure).toBe(2);
  });

  it('inserts an optional AO pass between the render and effect passes', () => {
    const renderer = {
      autoClear: true,
      toneMapping: NoToneMapping,
      toneMappingExposure: 1,
      outputColorSpace: SRGBColorSpace,
      getPixelRatio: vi.fn(() => 1),
      getSize: vi.fn((target: Vector2) => target.set(640, 480)),
    } as unknown as WebGLRenderer;

    const effectPass = { id: 'effectPass' } as unknown as EffectPass;
    const aoPass = { id: 'aoPass' } as unknown as Pass;

    const result = createComposer({
      renderer,
      scene: {} as Scene,
      camera: {} as Camera,
      effectPass,
      colorPipeline: hdrPipeline,
      aoPass,
    });

    const composer = result.composer as unknown as InstanceType<typeof hoisted.MockEffectComposer>;
    expect(composer.passes).toHaveLength(3);
    expect(composer.passes[1]).toBe(aoPass);
    expect(composer.passes[2]).toBe(effectPass);
  });

  it('disposes render resources idempotently', () => {
    const renderer = {
      autoClear: false,
      toneMapping: NoToneMapping,
      toneMappingExposure: 1,
      outputColorSpace: SRGBColorSpace,
      getPixelRatio: vi.fn(() => 1),
      getSize: vi.fn((target: Vector2) => target.set(100, 100)),
    } as unknown as WebGLRenderer;

    const result = createComposer({
      renderer,
      scene: {} as Scene,
      camera: {} as Camera,
      effectPass: {} as unknown as EffectPass,
      colorPipeline: hdrPipeline,
    });

    const renderTargetDispose = vi.spyOn(result.renderTarget, 'dispose');

    result.dispose();
    result.dispose();

    expect(hoisted.mockComposerDispose).toHaveBeenCalledTimes(1);
    expect(renderTargetDispose).toHaveBeenCalledTimes(1);
  });

  it('keeps the sRGB target on the legacy pipeline', () => {
    const renderer = {
      autoClear: true,
      toneMapping: NoToneMapping,
      toneMappingExposure: 1,
      outputColorSpace: SRGBColorSpace,
      getPixelRatio: vi.fn(() => 1),
      getSize: vi.fn((target: Vector2) => target.set(320, 240)),
    } as unknown as WebGLRenderer;

    const result = createComposer({
      renderer,
      scene: {} as Scene,
      camera: {} as Camera,
      effectPass: {} as unknown as EffectPass,
      colorPipeline: legacyPipeline,
    });

    const composer = result.composer as unknown as InstanceType<typeof hoisted.MockEffectComposer>;
    expect((composer.renderTarget as any).texture.colorSpace).toBe(SRGBColorSpace);
    // Renderer state is identical to the enabled path: tone mapping is the
    // effect, so the renderer only performs the final sRGB encode.
    expect(renderer.outputColorSpace).toBe(SRGBColorSpace);
    expect(renderer.toneMapping).toBe(NoToneMapping);
    // Legacy path pins exposure to today's value.
    expect(renderer.toneMappingExposure).toBe(1);
  });

  it('drives renderer tone-mapping exposure from colorPipeline when enabled', () => {
    const renderer = {
      autoClear: true,
      toneMapping: NoToneMapping,
      toneMappingExposure: 3,
      outputColorSpace: SRGBColorSpace,
      getPixelRatio: vi.fn(() => 1),
      getSize: vi.fn((target: Vector2) => target.set(320, 240)),
    } as unknown as WebGLRenderer;

    const result = createComposer({
      renderer,
      scene: {} as Scene,
      camera: {} as Camera,
      effectPass: {} as unknown as EffectPass,
      colorPipeline: { ...hdrPipeline, exposure: 1.4 },
    });

    // The tone-mapping operator reads three's built-in `toneMappingExposure`
    // uniform, uploaded from `renderer.toneMappingExposure`.
    expect(renderer.toneMappingExposure).toBe(1.4);

    // Restoring still returns the renderer to its pre-composer exposure.
    result.restoreRendererState();
    expect(renderer.toneMappingExposure).toBe(3);
  });
});
