import { describe, expect, it, beforeEach, vi } from 'vitest';
import { LinearSRGBColorSpace, NoToneMapping, SRGBColorSpace, Vector2 } from 'three';
import type { Camera, Scene, WebGLRenderer } from 'three';
import type { EffectPass } from 'postprocessing';

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

    const result = createComposer({ renderer, scene, camera, effectPass });

    expect(renderer.autoClear).toBe(false);
    expect(renderer.outputColorSpace).toBe(SRGBColorSpace);
    expect(renderer.toneMapping).toBe(NoToneMapping);
    expect(renderer.toneMappingExposure).toBe(1);

    const composer = result.composer as unknown as InstanceType<typeof hoisted.MockEffectComposer>;
    expect((composer.renderTarget as any).texture.colorSpace).toBe(SRGBColorSpace);
    expect(composer.passes).toHaveLength(2);
    expect(composer.passes[1]).toBe(effectPass);
    expect(result.renderTarget.width).toBeCloseTo(1200);
    expect(result.renderTarget.height).toBeCloseTo(900);

    result.restoreRendererState();
    expect(renderer.autoClear).toBe(true);
    expect(renderer.outputColorSpace).toBe(LinearSRGBColorSpace);
    expect(renderer.toneMappingExposure).toBe(2);
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
    });

    const renderTargetDispose = vi.spyOn(result.renderTarget, 'dispose');

    result.dispose();
    result.dispose();

    expect(hoisted.mockComposerDispose).toHaveBeenCalledTimes(1);
    expect(renderTargetDispose).toHaveBeenCalledTimes(1);
  });
});
