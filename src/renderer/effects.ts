import * as three from 'three';
import type { WebGLRenderer, Scene, PerspectiveCamera } from 'three';
import { FloatType, WebGLRenderTarget, NearestFilter, RGBAFormat, UnsignedByteType } from 'three';
import * as logger from '../utils/logger.js';

// Module-scoped helpers for safe readbacks
const tempRTCache: Record<string, WebGLRenderTarget> = {};
const blitScene = new three.Scene();
const blitCamera = new three.OrthographicCamera(-1, 1, 1, -1, 0, 1);
const blitGeom = new three.PlaneGeometry(2, 2);
const blitMat = new three.MeshBasicMaterial({ map: null as any });
const blitMesh = new three.Mesh(blitGeom, blitMat);
blitScene.add(blitMesh);

const packMat = new three.ShaderMaterial({
  uniforms: { tInput: { value: null as any } },
  vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position, 1.0); }',
  fragmentShader: 'precision highp float; varying vec2 vUv; uniform sampler2D tInput; vec4 packDepthToRGBA(const in float v) { vec4 enc = vec4(1.0, 256.0, 256.0*256.0, 256.0*256.0*256.0) * v; enc = fract(enc); enc -= enc.yzww * vec4(1.0/256.0, 1.0/256.0, 1.0/256.0, 0.0); return enc; } void main() { float d = texture2D(tInput, vUv).x; gl_FragColor = packDepthToRGBA(d); }',
  depthTest: false,
  depthWrite: false
});

const getTempRT = (srcRT: any) => {
  if (!srcRT || !srcRT.width || !srcRT.height) return null;
  const srcType = (srcRT.texture && srcRT.texture.type) || UnsignedByteType;
  const srcFormat = (srcRT.texture && srcRT.texture.format) || RGBAFormat;
  const needsRGBAUnsigned = !!(srcRT.depthTexture || (srcRT.texture && (srcType !== UnsignedByteType || srcFormat !== RGBAFormat)));
  const type = UnsignedByteType;
  const key = `${srcRT.width}x${srcRT.height}_${type}_${needsRGBAUnsigned ? 'RGBA_UBYTE' : 'SRC'}`;
  let t = tempRTCache[key];
  if (!t) {
    t = new WebGLRenderTarget(srcRT.width, srcRT.height, {
      minFilter: NearestFilter,
      magFilter: NearestFilter,
      format: RGBAFormat,
      type,
      depthBuffer: false,
      stencilBuffer: false
    });
    tempRTCache[key] = t;
  }
  return t;
};

const blitToTemp = (rend: WebGLRenderer, srcRT: any, dstRT: WebGLRenderTarget) => {
  try {
    const srcTexture = srcRT && srcRT.texture ? srcRT.texture : srcRT;
    const isDepthSource = !!(srcRT && (srcRT.depthTexture || (srcRT.texture && (srcRT.texture.type !== UnsignedByteType || srcRT.texture.format !== RGBAFormat))));
    if (isDepthSource) {
      try {
        (packMat as any).uniforms.tInput.value = srcTexture;
  packMat.needsUpdate = true;
  (blitMesh as any).material = packMat as any;
      } catch (e) {
  (blitMat as any).map = srcTexture;
  blitMat.needsUpdate = true;
  (blitMesh as any).material = blitMat as any;
      }
    } else {
      (blitMat as any).map = srcTexture;
      blitMat.needsUpdate = true;
      blitMesh.material = blitMat;
    }
    rend.setRenderTarget(dstRT);
    rend.render(blitScene, blitCamera);
    rend.setRenderTarget(null);
  } finally {
    try { (blitMat as any).map = null; } catch (e) {}
    try { (packMat as any).uniforms.tInput.value = null; } catch (e) {}
    try { (blitMesh as any).material = blitMat as any; } catch (e) {}
  }
};

const readPixelsSafe = (renderer: WebGLRenderer, renderTarget: any, x: number, y: number, width: number, height: number, buffer: Uint8Array | Uint8ClampedArray) => {
  const rendererRead = (renderer as any).readRenderTargetPixels;
  const hasAsync = typeof (renderer as any).readRenderTargetPixelsAsync === 'function';
  const temp = getTempRT(renderTarget);
  const src = temp || renderTarget;
  if (temp) {
    try { blitToTemp(renderer, renderTarget, temp); } catch (e) { /* ignore */ }
  }
  if (hasAsync) {
    return (renderer as any).readRenderTargetPixelsAsync(src, x, y, width, height, buffer);
  }
  return new Promise<void>((resolve) => {
    try {
      setTimeout(() => {
        try { rendererRead.call(renderer, src, x, y, width, height, buffer); } catch (e) { /* ignore */ }
        resolve();
      }, 0);
    } catch (e) { resolve(); }
  });
};
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

  // Reuse shared safe-read helpers defined at module scope (getTempRT, blitToTemp, readPixelsSafe)

  // Wrap renderer.readRenderTargetPixels to ensure any direct calls (including
  // inlined copies in bundled code) read from a non-active temporary render
  // target. This prevents feedback-loop reads from the currently bound
  // framebuffer which often trigger GPU stalls on some drivers.
  const wrapReadPixelsForRenderer = (rend: WebGLRenderer) => {
    try {
      const orig = (rend as any).readRenderTargetPixels;
      if (!orig || (orig as any).__effectsManagerPatched) return;

      (rend as any).readRenderTargetPixels = function (renderTarget: any, x: number, y: number, width: number, height: number, buffer: any, activeCubeFace?: number, level?: number) {
        try {
          if (renderTarget && renderTarget.texture) {
            const temp = getTempRT(renderTarget);
            if (temp) {
              try { logger.info('[EffectsManager] wrapper readRenderTargetPixels: using temp RT'); } catch (e) {}
              blitToTemp(this as WebGLRenderer, renderTarget, temp);
              return orig.call(this, temp, x, y, width, height, buffer, activeCubeFace, level);
            }
          }
        } catch (e) {
          // ignore wrapper failures and fall back to original
        }
        return orig.call(this, renderTarget, x, y, width, height, buffer, activeCubeFace, level);
      };
      (rend as any).readRenderTargetPixels.__effectsManagerPatched = true;
    } catch (e) {
      // best-effort
    }
  };

  // Apply wrapper to the renderer used by this manager
  try { wrapReadPixelsForRenderer(renderer); } catch (e) { /* ignore */ }

  // Instrument low-level GL readPixels to catch any callers (including
  // inlined/minified copies from the bundled runtime). This helps trace
  // which code is issuing readPixels and causing GPU stalls.
    // Keep a dedicated exported helper so callers can apply the same
    // low-level patches early during bootstrap. This is defined below and
    // invoked from createEffectsManager automatically, but can also be
    // imported and called before renderer creation to improve coverage.
    // See `export function applyGlobalPatches()` at the bottom of this file.
  // Also try to patch the three.js WebGLRenderer prototype in case the
  // bundle includes multiple copies or other modules create renderers.
  try {
  try { logger.info('[EffectsManager] attempting to patch WebGLRenderer.prototype'); } catch (e) {}
    if (three && (three as any).WebGLRenderer && (three as any).WebGLRenderer.prototype) {
      const proto = (three as any).WebGLRenderer.prototype;
      if (typeof proto.readRenderTargetPixels === 'function' && !(proto.readRenderTargetPixels as any).__effectsManagerPatched) {
        const orig = proto.readRenderTargetPixels;
        proto.readRenderTargetPixels = function (renderTarget: any, x: number, y: number, width: number, height: number, buffer: any, activeCubeFace?: number, level?: number) {
          try {
            if (renderTarget && renderTarget.texture) {
              const temp = getTempRT(renderTarget);
              if (temp) {
                try { logger.info('[EffectsManager] prototype wrapper: using temp RT'); } catch (e) {}
                blitToTemp(this as WebGLRenderer, renderTarget, temp);
                return orig.call(this, temp, x, y, width, height, buffer, activeCubeFace, level);
              }
            }
          } catch (e) {}
          return orig.call(this, renderTarget, x, y, width, height, buffer, activeCubeFace, level);
        };
        (proto.readRenderTargetPixels as any).__effectsManagerPatched = true;
      }
    }
    // Also attempt to patch any global WebGLRenderer constructor present
    try {
      const g: any = globalThis as any;
      if (g.WebGLRenderer && g.WebGLRenderer.prototype && typeof g.WebGLRenderer.prototype.readRenderTargetPixels === 'function' && !(g.WebGLRenderer.prototype.readRenderTargetPixels as any).__effectsManagerPatched) {
        const orig2 = g.WebGLRenderer.prototype.readRenderTargetPixels;
        g.WebGLRenderer.prototype.readRenderTargetPixels = function (renderTarget: any, x: number, y: number, width: number, height: number, buffer: any, activeCubeFace?: number, level?: number) {
          try {
            if (renderTarget && renderTarget.texture) {
              const temp = getTempRT(renderTarget);
              if (temp) {
                try { logger.info('[EffectsManager] global prototype wrapper: using temp RT'); } catch (e) {}
                blitToTemp(this as WebGLRenderer, renderTarget, temp);
                return orig2.call(this, temp, x, y, width, height, buffer, activeCubeFace, level);
              }
            }
          } catch (e) {}
          return orig2.call(this, renderTarget, x, y, width, height, buffer, activeCubeFace, level);
        };
        (g.WebGLRenderer.prototype.readRenderTargetPixels as any).__effectsManagerPatched = true;
      }
    } catch (e) {
      // ignore
    }
  } catch (e) {
    // best-effort
  }

  // Expose a global helper so callers (or early bootstrap code) can apply
  // the same global-level patches before createEffectsManager is invoked.
  try {
    const globalAny: any = (globalThis as any);
    if (!globalAny.__applyEffectsManagerGlobalPatches) {
      globalAny.__applyEffectsManagerGlobalPatches = () => {
        try {
          if (globalAny.__effectsManagerGLPatched) return;
          const wrap = (proto: any, name: string) => {
            if (!proto || typeof proto[name] !== 'function') return;
            const orig = proto[name];
            proto[name] = function () {
              try {
                const stack = (new Error()).stack || '';
                logger.info('[EffectsManager][GL] readPixels called, stack:', stack.split('\n').slice(0,4).join(' | '));
              } catch (e) {}
              return orig.apply(this, arguments as any);
            };
          };
          wrap((globalThis as any).WebGLRenderingContext?.prototype, 'readPixels');
          wrap((globalThis as any).WebGL2RenderingContext?.prototype, 'readPixels');
          globalAny.__effectsManagerGLPatched = true;
        } catch (e) { /* ignore */ }
      };
    }
  } catch (e) { /* ignore */ }

  // Safety patch: postprocessing's DepthCopyPass / DepthPickingPass perform
  // synchronous reads (renderer.readRenderTargetPixels) which can cause
  // GPU stalls and driver warnings when the readback happens while the
  // framebuffer/texture is still active. If possible, patch the pass so it
  // uses the non-blocking readRenderTargetPixelsAsync API.
  try {
    const DepthCopyPass = pp.DepthCopyPass || pp.DepthSavePass || pp.DepthSavePass?.DepthCopyPass;
    const DepthCopyMode = pp.DepthCopyMode || pp.DepthCopyMode;
      if (DepthCopyPass && typeof DepthCopyPass.prototype.render === 'function') {
      const originalRender = DepthCopyPass.prototype.render;
  try { logger.info('[EffectsManager] Patched DepthCopyPass.render to use async read when available'); } catch (e) { /* ignore logging errors */ }

      // helper to unpack RGBA->depth for non-float packed textures (matches postprocessing logic)
      const unpackRGBAToDepth = (packedDepth: Uint8Array) => {
        const unpackDownscale = 255 / 256;
        const f0 = unpackDownscale;
        const f1 = unpackDownscale / 256;
        const f2 = unpackDownscale / (256 ** 2);
        const f3 = 1 / (256 ** 3);
        return (packedDepth[0] * f0 + packedDepth[1] * f1 + packedDepth[2] * f2 + packedDepth[3] * f3) / 255;
      };

      DepthCopyPass.prototype.render = function (this: any, rendererArg: WebGLRenderer, inputBuffer?: any, delta?: number) {
        // Temporarily stub out the synchronous read to avoid blocking inside
        // the original implementation. Then perform a non-blocking read
        // ourselves if a callback/request is pending.
        const rendererRead = (rendererArg as any).readRenderTargetPixels;
        const hasAsyncRead = typeof (rendererArg as any).readRenderTargetPixelsAsync === 'function';

        // Replace sync read with a no-op while originalRender executes.
        (rendererArg as any).readRenderTargetPixels = function () { /* noop to avoid sync read */ };
        try {
          originalRender.call(this, rendererArg, inputBuffer, delta);
        } finally {
          // restore original
          (rendererArg as any).readRenderTargetPixels = rendererRead;
        }

        // If the pass created a callback (DepthPickingPass usage), perform
        // the read asynchronously and resolve the callback. Read from a
        // temporary copy of the renderTarget to avoid feedback loops.
        try {
          if (this.callback) {
            const renderTarget = this.renderTarget;
            const pixelBuffer = this.pixelBuffer || new Uint8Array(4);
            const packed = renderTarget && renderTarget.texture && renderTarget.texture.type !== FloatType;

            let x = 0, y = 0;
            try {
              const texelPosition = (this.fullscreenMaterial && (this.fullscreenMaterial as any).texelPosition) || { x: 0.5, y: 0.5 };
              if (renderTarget && renderTarget.width) x = Math.round(texelPosition.x * renderTarget.width);
              if (renderTarget && renderTarget.height) y = Math.round(texelPosition.y * renderTarget.height);
            } catch (e) {
              // fall back to 0,0
            }

            const temp = getTempRT(renderTarget);

            if (temp) {
              try { logger.info('[EffectsManager] depth-read temp=true async=' + hasAsyncRead + ' src=' + (renderTarget && renderTarget.texture && renderTarget.texture.name)); } catch (e) {}
              blitToTemp(rendererArg, renderTarget, temp);
              // Use the centralized safe read helper which will prefer async API
              // and otherwise perform a deferred sync read. This makes the
              // behavior deterministic and avoids inlined direct sync reads.
              try {
                readPixelsSafe(rendererArg, temp, x, y, 1, 1, pixelBuffer).then(() => {
                  try {
                    const value = packed ? unpackRGBAToDepth(pixelBuffer) : pixelBuffer[0];
                    try { this.callback(value); } catch (e) { /* ignore callback errors */ }
                  } finally {
                    this.callback = null;
                  }
                }).catch(() => {
                  // If safe-read fails unexpectedly, clear the callback to avoid leaks
                  this.callback = null;
                });
              } catch (err) {
                this.callback = null;
              }
            } else {
              // No temp RT available: fall back to previous behavior.
              try { logger.info('[EffectsManager] depth-read temp=false async=' + hasAsyncRead + ' src=' + (renderTarget && renderTarget.texture && renderTarget.texture.name)); } catch (e) {}
              if (hasAsyncRead) {
                (rendererArg as any).readRenderTargetPixelsAsync(renderTarget, x, y, 1, 1, pixelBuffer).then(() => {
                  try {
                    const value = packed ? unpackRGBAToDepth(pixelBuffer) : pixelBuffer[0];
                    try { this.callback(value); } catch (e) { /* ignore callback errors */ }
                  } finally {
                    this.callback = null;
                  }
                }).catch(() => {
                  // Async read failed — defer the sync read
                  try {
                    setTimeout(() => {
                      try {
                        rendererRead.call(rendererArg, renderTarget, x, y, 1, 1, pixelBuffer);
                        const value = packed ? unpackRGBAToDepth(pixelBuffer) : pixelBuffer[0];
                        try { this.callback(value); } catch (e) { /* ignore */ }
                      } catch (err) {
                        // swallow
                      } finally {
                        this.callback = null;
                      }
                    }, 0);
                  } catch (err) {
                    this.callback = null;
                  }
                });
              } else {
                // No async API: defer the sync read to avoid stalling the GPU mid-frame
                try {
                  setTimeout(() => {
                    try {
                      rendererRead.call(rendererArg, renderTarget, x, y, 1, 1, pixelBuffer);
                      const value = packed ? unpackRGBAToDepth(pixelBuffer) : pixelBuffer[0];
                      try { this.callback(value); } catch (e) { /* ignore */ }
                    } catch (err) {
                      // swallow
                    } finally {
                      this.callback = null;
                    }
                  }, 0);
                } catch (err) {
                  this.callback = null;
                }
              }
            }
          }
        } catch (err) {
          // Ensure read errors don't break rendering
        }
      };
    }
  } catch (e) {
    // best-effort patch; silently ignore if anything unexpected happens
  }

  // Feature flags: disable heavier postprocessing passes by default to
  // help isolate runtime WebGL issues (feedback loops). These can be
  // toggled at runtime via the enableMotionBlur/enableDepthOfField APIs
  // if the effects are available and required.
  const ENABLE_MOTION_BLUR = false;
  const ENABLE_DEPTH_OF_FIELD = false;

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

    // Motion blur for dynamic camera movement (only add if enabled)
    if (ENABLE_MOTION_BLUR && MotionBlurEffect) {
      motionBlurEffect = new MotionBlurEffect({
        intensity: 0.2,
        samples: 16
      });
      const motionBlurPass = new EffectPass(camera, motionBlurEffect);
      motionBlurPass.renderToScreen = false;
      composer.addPass(motionBlurPass);
    }

    // Depth of field for cinematic effect (only add if enabled)
    if (ENABLE_DEPTH_OF_FIELD && DepthOfFieldEffect) {
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

  // Instance-level patch: some builds inline/duplicate postprocessing so
  // patching the prototype may not affect the actually used instances.
  // Iterate the composer's passes and wrap any pass that appears to use
  // a pixel read/callback (DepthPickingPass style) to replace the
  // synchronous read with an async read when available.
  try {
    const hasAsyncRead = typeof (renderer as any).readRenderTargetPixelsAsync === 'function';
    const unpackRGBAToDepth = (packedDepth: Uint8Array) => {
      const unpackDownscale = 255 / 256;
      const f0 = unpackDownscale;
      const f1 = unpackDownscale / 256;
      const f2 = unpackDownscale / (256 ** 2);
      const f3 = 1 / (256 ** 3);
      return (packedDepth[0] * f0 + packedDepth[1] * f1 + packedDepth[2] * f2 + packedDepth[3] * f3) / 255;
    };


    const patchInstance = (pass: any) => {
      if (!pass || typeof pass.render !== 'function') return;
      // Heuristic: DepthPickingPass exposes `callback` and `renderTarget`/`pixelBuffer`.
      if (!('callback' in pass) && !('pixelBuffer' in pass) && !('renderTarget' in pass)) return;

      const original = pass.render.bind(pass);
      pass.render = function (rend: WebGLRenderer, inputBuffer?: any, delta?: number) {
        const rendererRead = (rend as any).readRenderTargetPixels;
        // noop sync read during original render to avoid immediate ReadPixels
        (rend as any).readRenderTargetPixels = function () { /* noop */ };
        try {
          original(rend, inputBuffer, delta);
        } finally {
          (rend as any).readRenderTargetPixels = rendererRead;
        }

        try {
          if (this.callback) {
            const renderTarget = this.renderTarget;
            const pixelBuffer = this.pixelBuffer || new Uint8Array(4);
            const packed = renderTarget && renderTarget.texture && renderTarget.texture.type !== FloatType;

            let x = 0, y = 0;
            try {
              const texelPosition = (this.fullscreenMaterial && this.fullscreenMaterial.texelPosition) || { x: 0.5, y: 0.5 };
              if (renderTarget && renderTarget.width) x = Math.round(texelPosition.x * renderTarget.width);
              if (renderTarget && renderTarget.height) y = Math.round(texelPosition.y * renderTarget.height);
            } catch (e) {
              // fall back to 0,0
            }

              // Use centralized safe-read helper for instance patch too.
              try {
                readPixelsSafe(rend, renderTarget, x, y, 1, 1, pixelBuffer).then(() => {
                  try {
                    const value = packed ? unpackRGBAToDepth(pixelBuffer) : pixelBuffer[0];
                    try { this.callback(value); } catch (e) { /* ignore callback errors */ }
                  } finally {
                    this.callback = null;
                  }
                }).catch(() => {
                  this.callback = null;
                });
              } catch (err) {
                this.callback = null;
              }
          }
        } catch (err) {
          // never let read errors break the render loop
        }
      };
    };

    try {
      const passes = (composer as any).passes || [];
      passes.forEach(patchInstance);
    } catch (e) {
      // ignore
    }
    // Also patch EffectComposer.prototype.addPass so any passes added later
    // (e.g. by other modules or delayed initialization) will also be wrapped.
    try {
      const composerProto: any = (EffectComposer && (EffectComposer as any).prototype) || null;
      if (composerProto && typeof composerProto.addPass === 'function') {
        const originalAddPass = composerProto.addPass;
        composerProto.addPass = function (this: any, pass: any) {
          try { originalAddPass.call(this, pass); } catch (e) { /* still try to patch instance */ }
          try { patchInstance(pass); } catch (err) { /* ignore patch errors */ }
        };
      }
    } catch (e) {
      // best-effort
    }
  } catch (e) {
    // best-effort
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

  // Exported helper to apply global instrumentation and prototype patches
  // early in the application lifecycle. This function is idempotent and
  // safe to call multiple times.
  export function applyGlobalPatches() {
    try {
      const globalAny: any = (globalThis as any);
      if (globalAny.__effectsManagerGlobalPatchesApplied) return;

      const wrapGLRead = (proto: any, name: string) => {
        if (!proto || typeof proto[name] !== 'function') return;
        const orig = proto[name];
        proto[name] = function () {
          try {
            const stack = (new Error()).stack || '';
            logger.info('[EffectsManager][GL] readPixels called, stack:', stack.split('\n').slice(0,4).join(' | '));
          } catch (e) {}
          return orig.apply(this, arguments as any);
        };
      };

      try { wrapGLRead((globalThis as any).WebGLRenderingContext?.prototype, 'readPixels'); } catch (e) {}
      try { wrapGLRead((globalThis as any).WebGL2RenderingContext?.prototype, 'readPixels'); } catch (e) {}

      // Patch three.js prototype if available
      try {
        if (three && (three as any).WebGLRenderer && (three as any).WebGLRenderer.prototype) {
          const proto = (three as any).WebGLRenderer.prototype;
          if (typeof proto.readRenderTargetPixels === 'function' && !(proto.readRenderTargetPixels as any).__effectsManagerPatched) {
            const orig = proto.readRenderTargetPixels;
            proto.readRenderTargetPixels = function (renderTarget: any, x: number, y: number, width: number, height: number, buffer: any, activeCubeFace?: number, level?: number) {
              try {
                if (renderTarget && renderTarget.texture) {
                  const temp = getTempRT(renderTarget);
                  if (temp) {
                    try { logger.info('[EffectsManager] prototype wrapper: using temp RT'); } catch (e) {}
                    blitToTemp(this as WebGLRenderer, renderTarget, temp);
                    return orig.call(this, temp, x, y, width, height, buffer, activeCubeFace, level);
                  }
                }
              } catch (e) {}
              return orig.call(this, renderTarget, x, y, width, height, buffer, activeCubeFace, level);
            };
            (proto.readRenderTargetPixels as any).__effectsManagerPatched = true;
          }
        }
      } catch (e) { /* ignore */ }

      // Patch any global WebGLRenderer constructor
      try {
        const g: any = globalThis as any;
        if (g.WebGLRenderer && g.WebGLRenderer.prototype && typeof g.WebGLRenderer.prototype.readRenderTargetPixels === 'function' && !(g.WebGLRenderer.prototype.readRenderTargetPixels as any).__effectsManagerPatched) {
          const orig2 = g.WebGLRenderer.prototype.readRenderTargetPixels;
          g.WebGLRenderer.prototype.readRenderTargetPixels = function (renderTarget: any, x: number, y: number, width: number, height: number, buffer: any, activeCubeFace?: number, level?: number) {
            try {
              if (renderTarget && renderTarget.texture) {
                const temp = getTempRT(renderTarget);
                if (temp) {
                  try { logger.info('[EffectsManager] global prototype wrapper: using temp RT'); } catch (e) {}
                  blitToTemp(this as WebGLRenderer, renderTarget, temp);
                  return orig2.call(this, temp, x, y, width, height, buffer, activeCubeFace, level);
                }
              }
            } catch (e) {}
            return orig2.call(this, renderTarget, x, y, width, height, buffer, activeCubeFace, level);
          };
          (g.WebGLRenderer.prototype.readRenderTargetPixels as any).__effectsManagerPatched = true;
        }
      } catch (e) { /* ignore */ }

      globalAny.__effectsManagerGlobalPatchesApplied = true;
    } catch (e) { /* ignore */ }
  }
