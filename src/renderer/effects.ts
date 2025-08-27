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
  // Lazy import to avoid build-time coupling; cast to any to be robust during scaffolding.
  // The project installs `postprocessing`, so replace any casts with concrete types as you flesh this out.
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const postprocessing = require('postprocessing') as any;

  const composer = new postprocessing.EffectComposer(renderer);
  const RenderPass = postprocessing.RenderPass || postprocessing.Pass || (class { constructor() {} });
  // Add a basic render pass
  try {
    const rp = new postprocessing.RenderPass(scene, camera);
    composer.addPass(rp);
  } catch (e) {
    // ignore on scaffold
  }

  return {
    initDone: true,
    render(dt: number) {
      if ((composer as any).render) {
        // postprocessing uses delta in render call in some versions
        try { (composer as any).render(dt); } catch (_) { (composer as any).render(); }
      } else {
        // fallback: nothing
      }
    },
    resize(width: number, height: number) {
      try { composer.setSize(width, height); } catch (e) { /* ignore scaffold */ }
    },
    dispose() {
      try { composer.dispose?.(); } catch (e) { /* ignore scaffold */ }
    }
  };
}
