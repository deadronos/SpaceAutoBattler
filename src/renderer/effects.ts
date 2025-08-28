import type { WebGLRenderer, Scene, PerspectiveCamera } from 'three';
// Lightweight wrapper around `postprocessing` to manage effect composer and passes.
// This is a scaffold/stub: add or tune passes as needed in renderer integration.

export interface EffectsManager {
  initDone: boolean;
  render: (dt: number) => void;
  resize: (width: number, height: number) => void;
  dispose: () => void;
  // New methods for dynamic effects
  setBloomIntensity: (intensity: number) => void;
  enableMotionBlur: (enabled: boolean) => void;
  enableDepthOfField: (enabled: boolean) => void;
  addExplosionEffect: (position: { x: number; y: number; z: number }, intensity: number) => void;
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
      dispose: () => { /* noop */ },
      setBloomIntensity: () => {},
      enableMotionBlur: () => {},
      enableDepthOfField: () => {},
      addExplosionEffect: () => {}
    };
  }

  // Create composer and passes with defensive checks
  const EffectComposer = pp.EffectComposer || pp.Composer || pp.default?.EffectComposer;
  const RenderPass = pp.RenderPass || pp.Pass || pp.default?.RenderPass;
  const EffectPass = pp.EffectPass || pp.Pass || pp.default?.EffectPass;
  const BloomEffect = pp.BloomEffect || pp.default?.BloomEffect || pp.default?.SelectiveBloomEffect;
  const ToneMappingEffect = pp.ToneMappingEffect || pp.default?.ToneMappingEffect;
  const MotionBlurEffect = pp.MotionBlurEffect || pp.default?.MotionBlurEffect;
  const DepthOfFieldEffect = pp.DepthOfFieldEffect || pp.default?.DepthOfFieldEffect;
  const SMAAEffect = pp.SMAAEffect || pp.default?.SMAAEffect;
  const FXAAEffect = pp.FXAAEffect || pp.default?.FXAAEffect;

  const composer = new (EffectComposer)(renderer);

  let bloomEffect: any = null;
  let motionBlurEffect: any = null;
  let depthOfFieldEffect: any = null;

  try {
    if (RenderPass) composer.addPass(new RenderPass(scene, camera));

    // Enhanced bloom with selective rendering
    if (BloomEffect) {
      bloomEffect = new BloomEffect({
        intensity: 0.6,
        luminanceThreshold: 0.4,
        luminanceSmoothing: 0.1,
        mipmapBlur: true,
        radius: 0.8
      });
      const bloomPass = new EffectPass(camera, bloomEffect);
      bloomPass.renderToScreen = false;
      composer.addPass(bloomPass);
    }

    // Motion blur for dynamic camera movement
    if (MotionBlurEffect) {
      motionBlurEffect = new MotionBlurEffect({
        intensity: 0.2,
        samples: 16
      });
      const motionBlurPass = new EffectPass(camera, motionBlurEffect);
      motionBlurPass.renderToScreen = false;
      composer.addPass(motionBlurPass);
    }

    // Depth of field for cinematic effect
    if (DepthOfFieldEffect) {
      depthOfFieldEffect = new DepthOfFieldEffect(camera, {
        focusDistance: 0.5,
        focalLength: 0.05,
        bokehScale: 2.0
      });
      const depthOfFieldPass = new EffectPass(camera, depthOfFieldEffect);
      depthOfFieldPass.renderToScreen = false;
      composer.addPass(depthOfFieldPass);
    }

    // Anti-aliasing (prefer SMAA, fallback to FXAA)
    let aaEffect: any = null;
    if (SMAAEffect) {
      aaEffect = new SMAAEffect();
    } else if (FXAAEffect) {
      aaEffect = new FXAAEffect();
    }

    if (aaEffect) {
      const aaPass = new EffectPass(camera, aaEffect);
      aaPass.renderToScreen = false;
      composer.addPass(aaPass);
    }

    // Enhanced tone mapping
    if (ToneMappingEffect) {
      const tone = new ToneMappingEffect({
        adaptive: true,
        resolution: 256,
        whitePoint: 16.0,
        middleGrey: 0.6,
        minLuminance: 0.01,
        averageLuminance: 1.0,
        adaptationRate: 1.0
      });
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
    },
    setBloomIntensity(intensity: number) {
      if (bloomEffect) {
        bloomEffect.intensity = intensity;
      }
    },
    enableMotionBlur(enabled: boolean) {
      if (motionBlurEffect) {
        motionBlurEffect.intensity = enabled ? 0.2 : 0;
      }
    },
    enableDepthOfField(enabled: boolean) {
      if (depthOfFieldEffect) {
        depthOfFieldEffect.intensity = enabled ? 1.0 : 0;
      }
    },
    addExplosionEffect(position: { x: number; y: number; z: number }, intensity: number) {
      // Temporarily boost bloom for explosion effect
      if (bloomEffect) {
        const originalIntensity = bloomEffect.intensity;
        bloomEffect.intensity = Math.max(originalIntensity, intensity);

        // Reset after a short duration
        setTimeout(() => {
          bloomEffect.intensity = originalIntensity;
        }, 500);
      }
    }
  };
}
