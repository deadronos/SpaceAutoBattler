import { EffectComposer, RenderPass, type EffectPass, type Pass } from 'postprocessing';
import {
  type WebGLRenderer,
  type Scene,
  type Camera,
  WebGLRenderTarget,
  HalfFloatType,
  NoColorSpace,
  RGBAFormat,
  SRGBColorSpace,
  NoToneMapping,
  Vector2,
} from 'three';
import type { ColorPipelineConfig } from '../../config/renderer.js';

export interface CreateComposerOptions {
  renderer: WebGLRenderer;
  scene: Scene;
  camera: Camera;
  effectPass: EffectPass;
  /**
   * Linear-HDR + tone-mapping pipeline config. When `enabled`, the HalfFloat
   * target is tagged `NoColorSpace` (linear HDR); when disabled it keeps the
   * historical `SRGBColorSpace` tag.
   */
  colorPipeline: ColorPipelineConfig;
  /**
   * Optional ambient-occlusion pass inserted between the render pass and the
   * effect pass. Absent/`null` keeps the historical two-pass composer.
   */
  aoPass?: Pass | null;
}

export interface ComposerSetupResult {
  composer: EffectComposer;
  renderTarget: WebGLRenderTarget;
  dispose: () => void;
  restoreRendererState: () => void;
}

export function createComposer({
  renderer,
  scene,
  camera,
  effectPass,
  colorPipeline,
  aoPass,
}: CreateComposerOptions): ComposerSetupResult {
  const previousState = {
    autoClear: renderer.autoClear,
    toneMapping: renderer.toneMapping,
    toneMappingExposure: renderer.toneMappingExposure,
    outputColorSpace: renderer.outputColorSpace,
  } as const;

  let restored = false;
  const restoreRendererState = (): void => {
    if (restored) return;
    restored = true;
    renderer.autoClear = previousState.autoClear;
    renderer.toneMapping = previousState.toneMapping;
    renderer.toneMappingExposure = previousState.toneMappingExposure;
    renderer.outputColorSpace = previousState.outputColorSpace;
  };

  try {
    renderer.autoClear = false;
    renderer.outputColorSpace = SRGBColorSpace;
    renderer.toneMapping = NoToneMapping;
    renderer.toneMappingExposure = 1;

    const size = renderer.getSize(new Vector2());
    const pixelRatio = renderer.getPixelRatio();
    const renderTarget = new WebGLRenderTarget(size.x * pixelRatio, size.y * pixelRatio, {
      format: RGBAFormat,
      type: HalfFloatType,
    });
    // Linear-HDR pipeline: keep the HDR half-float values unencoded so the
    // tone-mapping effect (not the target) performs the display transform. The
    // legacy path keeps the historical sRGB tag.
    renderTarget.texture.colorSpace = colorPipeline.enabled ? NoColorSpace : SRGBColorSpace;

    const composer = new EffectComposer(renderer, renderTarget);
    const renderPass = new RenderPass(scene, camera);
    composer.addPass(renderPass);
    if (aoPass) {
      composer.addPass(aoPass);
    }
    composer.addPass(effectPass);

    let disposed = false;
    const dispose = (): void => {
      if (disposed) return;
      disposed = true;
      composer.dispose();
      renderTarget.dispose();
    };

    return {
      composer,
      renderTarget,
      dispose,
      restoreRendererState,
    };
  } catch (error) {
    restoreRendererState();
    throw error;
  }
}
