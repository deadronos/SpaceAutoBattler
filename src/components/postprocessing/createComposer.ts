import { EffectComposer, RenderPass, type EffectPass } from 'postprocessing';
import {
  type WebGLRenderer,
  type Scene,
  type Camera,
  WebGLRenderTarget,
  HalfFloatType,
  RGBAFormat,
  SRGBColorSpace,
  NoToneMapping,
  Vector2,
} from 'three';

export interface CreateComposerOptions {
  renderer: WebGLRenderer;
  scene: Scene;
  camera: Camera;
  effectPass: EffectPass;
}

export interface ComposerSetupResult {
  composer: EffectComposer;
  renderTarget: WebGLRenderTarget;
  dispose: () => void;
  restoreRendererState: () => void;
}

export function createComposer({ renderer, scene, camera, effectPass }: CreateComposerOptions): ComposerSetupResult {
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
    renderTarget.texture.colorSpace = SRGBColorSpace;

    const composer = new EffectComposer(renderer, renderTarget);
    const renderPass = new RenderPass(scene, camera);
    composer.addPass(renderPass);
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
