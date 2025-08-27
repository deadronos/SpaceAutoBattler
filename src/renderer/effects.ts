import type { WebGLRenderer, Scene, PerspectiveCamera } from 'three';
// Lightweight wrapper around `postprocessing` to manage effect composer and passes.
// This is a scaffold/stub: add or tune passes as needed in renderer integration.

export interface EffectsManager {
  initDone: boolean;
  render: (dt: number) => void;
  resize: (width: number, height: number) => void;
  dispose: () => void;
}

export function createEffectsManager(renderer: WebGLRenderer, scene: Scene, camera: PerspectiveCamera): EffectsManager {
  // Lazy import to avoid build-time coupling; most deployments will have `postprocessing` installed.
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  let pp: any = null;
  try { pp = require('postprocessing'); } catch (e) { pp = null; }

  if (!pp) {
    // No postprocessing available: return no-op manager
    return {
      initDone: true,
      render: (_dt: number) => { /* noop */ },
      resize: (_w: number, _h: number) => { /* noop */ },
      dispose: () => { /* noop */ }
    };
  }

  // Create composer and passes with defensive checks
  const EffectComposer = pp.EffectComposer || pp.Composer || pp.default?.EffectComposer;
  const RenderPass = pp.RenderPass || pp.Pass || pp.default?.RenderPass;
  const EffectPass = pp.EffectPass || pp.Pass || pp.default?.EffectPass;
  const BloomEffect = pp.BloomEffect || pp.default?.BloomEffect || pp.default?.SelectiveBloomEffect;
  const ToneMappingEffect = pp.ToneMappingEffect || pp.default?.ToneMappingEffect;

  const composer = new (EffectComposer)(renderer);

  try {
    if (RenderPass) composer.addPass(new RenderPass(scene, camera));
    // Add bloom
    if (BloomEffect) {
      const bloom = new BloomEffect({ intensity: 0.3, luminanceThreshold: 0.6, luminanceSmoothing: 0.05 });
      const bloomPass = new EffectPass(camera, bloom);
      bloomPass.renderToScreen = false;
      composer.addPass(bloomPass);
    }
    // Tone mapping / filmic
    if (ToneMappingEffect) {
      const tone = new ToneMappingEffect({ adaptive: false });
      const tonePass = new EffectPass(camera, tone);
      tonePass.renderToScreen = true;
      composer.addPass(tonePass);
    }
  } catch (e) {
    // If any pass fails, fall back to just the render pass
    try { if (RenderPass) composer.addPass(new RenderPass(scene, camera)); } catch (e) { /* ignore */ }
  }

  return {
    initDone: true,
    render(dt: number) {
      try { (composer as any).render(dt); } catch (e) { try { (composer as any).render(); } catch (_) { /* ignore */ } }
    },
    resize(width: number, height: number) {
      try { composer.setSize(width, height); } catch (e) { /* ignore */ }
    },
    dispose() {
      try { composer.dispose?.(); } catch (e) { /* ignore */ }
    }
  };
}
