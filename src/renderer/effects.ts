import * as three from 'three';
import type { WebGLRenderer, Scene, PerspectiveCamera } from 'three';
import { FloatType, WebGLRenderTarget, NearestFilter, RGBAFormat, UnsignedByteType } from 'three';
import * as logger from '../utils/logger.js';

/* eslint-disable @typescript-eslint/no-explicit-any */

// Module-scoped helpers for safe readbacks
const tempRTCache: Record<string, WebGLRenderTarget> = {};
const blitScene = new three.Scene();
const blitCamera = new three.OrthographicCamera(-1, 1, 1, -1, 0, 1);
const blitGeom = new three.PlaneGeometry(2, 2);
// helper to avoid repeated `asAny(x)` casts while keeping runtime behavior identical
// Accept unknown to encourage callers to pass values without using `any` directly.
const asAny = (v: unknown) => v as any;

const blitMat = new three.MeshBasicMaterial({ map: asAny(null) });
const blitMesh = new three.Mesh(blitGeom, blitMat);
blitScene.add(blitMesh);

const packMat = new three.ShaderMaterial({
  uniforms: { tInput: { value: asAny(null) } },
  vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position, 1.0); }',
  fragmentShader:
    'precision highp float; varying vec2 vUv; uniform sampler2D tInput; vec4 packDepthToRGBA(const in float v) { vec4 enc = vec4(1.0, 256.0, 256.0*256.0, 256.0*256.0*256.0) * v; enc = fract(enc); enc -= enc.yzww * vec4(1.0/256.0, 1.0/256.0, 1.0/256.0, 0.0); return enc; } void main() { float d = texture2D(tInput, vUv).x; gl_FragColor = packDepthToRGBA(d); }',
  depthTest: false,
  depthWrite: false,
});

// helper to unpack RGBA->depth for non-float packed textures (matches postprocessing logic)
const unpackRGBAToDepth = (packedDepth: Uint8Array) => {
  const unpackDownscale = 255 / 256;
  const f0 = unpackDownscale;
  const f1 = unpackDownscale / 256;
  const f2 = unpackDownscale / 256 ** 2;
  const f3 = 1 / 256 ** 3;
  return (
    (packedDepth[0] * f0 + packedDepth[1] * f1 + packedDepth[2] * f2 + packedDepth[3] * f3) / 255
  );
};

const getTempRT = (srcRT: unknown) => {
  const rt: any = asAny(srcRT);
  if (!rt || !rt.width || !rt.height) return null;
  const srcType = (rt.texture && rt.texture.type) || UnsignedByteType;
  const srcFormat = (rt.texture && rt.texture.format) || RGBAFormat;
  const needsRGBAUnsigned = !!(
    rt.depthTexture ||
    (rt.texture && (srcType !== UnsignedByteType || srcFormat !== RGBAFormat))
  );
  const type = UnsignedByteType;
  const key = `${rt.width}x${rt.height}_${type}_${needsRGBAUnsigned ? 'RGBA_UBYTE' : 'SRC'}`;
  let t = tempRTCache[key];
  if (!t) {
    t = new WebGLRenderTarget(rt.width, rt.height, {
      minFilter: NearestFilter,
      magFilter: NearestFilter,
      format: RGBAFormat,
      type,
      depthBuffer: false,
      stencilBuffer: false,
    });
    tempRTCache[key] = t;
  }
  return t;
};

const blitToTemp = (rend: WebGLRenderer, srcRT: unknown, dstRT: WebGLRenderTarget) => {
  try {
    const s: any = asAny(srcRT);
    const srcTexture = s && s.texture ? s.texture : s;
    const isDepthSource = !!(
      s &&
      (s.depthTexture ||
        (s.texture && (s.texture.type !== UnsignedByteType || s.texture.format !== RGBAFormat)))
    );
    if (isDepthSource) {
      try {
        asAny(packMat).uniforms.tInput.value = srcTexture;
        packMat.needsUpdate = true;
        asAny(blitMesh).material = asAny(packMat);
      } catch (_e) {
        void _e;
        asAny(blitMat).map = srcTexture;
        blitMat.needsUpdate = true;
        asAny(blitMesh).material = asAny(blitMat);
      }
    } else {
      asAny(blitMat).map = srcTexture;
      blitMat.needsUpdate = true;
      blitMesh.material = blitMat;
    }
    rend.setRenderTarget(dstRT);
    rend.render(blitScene, blitCamera);
    rend.setRenderTarget(null);
  } finally {
    try {
      asAny(blitMat).map = null;
    } catch (_e) {
      void _e;
    }
    try {
      asAny(packMat).uniforms.tInput.value = null;
    } catch (_e) {
      void _e;
    }
    try {
      asAny(blitMesh).material = asAny(blitMat);
    } catch (_e) {
      void _e;
    }
  }
};

const readPixelsSafe = (
  renderer: WebGLRenderer,
  renderTarget: unknown,
  x: number,
  y: number,
  width: number,
  height: number,
  buffer: Uint8Array | Uint8ClampedArray,
) => {
  const rendererRead = asAny(renderer).readRenderTargetPixels;
  const hasAsync = typeof asAny(renderer).readRenderTargetPixelsAsync === 'function';
  const temp = getTempRT(renderTarget);
  const src = temp || asAny(renderTarget);
  if (temp) {
    try {
      blitToTemp(renderer, renderTarget, temp);
    } catch (_e) {
      void _e;
    }
  }
  if (hasAsync) {
    return asAny(renderer).readRenderTargetPixelsAsync(src, x, y, width, height, buffer);
  }
  return new Promise<void>((resolve) => {
    try {
      setTimeout(() => {
        try {
          rendererRead.call(renderer, src, x, y, width, height, buffer);
        } catch (_e) {
          void _e;
        }
        resolve();
      }, 0);
    } catch (_e) {
      void _e;
      resolve();
    }
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
  addHitSpark: (
    position: { x: number; y: number; z: number },
    opts?: { intensity?: number },
  ) => void;
}

export function createEffectsManager(
  renderer: WebGLRenderer,
  scene: Scene,
  camera: PerspectiveCamera,
): EffectsManager {
  // Lazy import to avoid build-time coupling; most deployments will have `postprocessing` installed.

  let pp: unknown = null;
  try {
    pp = require('postprocessing');
  } catch (_e) {
    void _e;
    pp = null;
  }

  if (!pp) {
    // No postprocessing available: return no-op manager
    return {
      initDone: true,
      render: (_dt: number) => {
        /* noop */
      },
      resize: (_w: number, _h: number) => {
        /* noop */
      },
      dispose: () => {
        /* noop */
      },
      setBloomIntensity: () => {},
      enableMotionBlur: () => {},
      enableDepthOfField: () => {},
      addExplosionEffect: () => {},
      addHitSpark: () => {},
    };
  }

  // Create composer and passes with defensive checks
  const ppAny: any = asAny(pp);
  const EffectComposer = ppAny.EffectComposer || ppAny.Composer || ppAny.default?.EffectComposer;
  const RenderPass = ppAny.RenderPass || ppAny.Pass || ppAny.default?.RenderPass;
  const EffectPass = ppAny.EffectPass || ppAny.Pass || ppAny.default?.EffectPass;
  const BloomEffect =
    ppAny.BloomEffect || ppAny.default?.BloomEffect || ppAny.default?.SelectiveBloomEffect;
  const ToneMappingEffect = ppAny.ToneMappingEffect || ppAny.default?.ToneMappingEffect;
  const MotionBlurEffect = ppAny.MotionBlurEffect || ppAny.default?.MotionBlurEffect;
  const DepthOfFieldEffect = ppAny.DepthOfFieldEffect || ppAny.default?.DepthOfFieldEffect;
  const SMAAEffect = ppAny.SMAAEffect || ppAny.default?.SMAAEffect;
  const FXAAEffect = ppAny.FXAAEffect || ppAny.default?.FXAAEffect;

  const composer = new EffectComposer(renderer);

  // Reuse shared safe-read helpers defined at module scope (getTempRT, blitToTemp, readPixelsSafe)

  // Wrap renderer.readRenderTargetPixels to ensure any direct calls (including
  // inlined copies in bundled code) read from a non-active temporary render
  // target. This prevents feedback-loop reads from the currently bound
  // framebuffer which often trigger GPU stalls on some drivers.
  const wrapReadPixelsForRenderer = (rend: WebGLRenderer) => {
    try {
      const orig = asAny(rend).readRenderTargetPixels;
      if (!orig || asAny(orig).__effectsManagerPatched) return;

      asAny(rend).readRenderTargetPixels = function (
        renderTarget: any,
        x: number,
        y: number,
        width: number,
        height: number,
        buffer: any,
        activeCubeFace?: number,
        level?: number,
      ) {
        try {
          if (renderTarget && renderTarget.texture) {
            const temp = getTempRT(renderTarget);
            if (temp) {
              try {
                logger.info('[EffectsManager] wrapper readRenderTargetPixels: using temp RT');
              } catch (_e) {
                void _e; /* no-op */
              }
              blitToTemp(this as WebGLRenderer, renderTarget, temp);
              return orig.call(this, temp, x, y, width, height, buffer, activeCubeFace, level);
            }
          }
        } catch (_e) {
          void _e; // ignore wrapper failures and fall back to original
        }
        return orig.call(this, renderTarget, x, y, width, height, buffer, activeCubeFace, level);
      };
      asAny(rend).readRenderTargetPixels.__effectsManagerPatched = true;
    } catch (_e) {
      void _e; // best-effort
    }
  };

  // Apply wrapper to the renderer used by this manager
  try {
    wrapReadPixelsForRenderer(renderer);
  } catch (_e) {
    void _e;
  }

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
    try {
      logger.info('[EffectsManager] attempting to patch WebGLRenderer.prototype');
    } catch (_e) {
      void _e;
    }
    if (three && asAny(three).WebGLRenderer && asAny(three).WebGLRenderer.prototype) {
      const proto = asAny(three).WebGLRenderer.prototype;
      if (
        typeof proto.readRenderTargetPixels === 'function' &&
        !asAny(proto.readRenderTargetPixels).__effectsManagerPatched
      ) {
        const orig = proto.readRenderTargetPixels;
        proto.readRenderTargetPixels = function (
          renderTarget: any,
          x: number,
          y: number,
          width: number,
          height: number,
          buffer: any,
          activeCubeFace?: number,
          level?: number,
        ) {
          try {
            if (renderTarget && renderTarget.texture) {
              const temp = getTempRT(renderTarget);
              if (temp) {
                try {
                  logger.info('[EffectsManager] prototype wrapper: using temp RT');
                } catch (_e) {
                  void _e; /* no-op */
                }
                blitToTemp(this as WebGLRenderer, renderTarget, temp);
                return orig.call(this, temp, x, y, width, height, buffer, activeCubeFace, level);
              }
            }
          } catch (_e) {
            void _e; // ignore wrapper failures and fall back to original
          }
          return orig.call(this, renderTarget, x, y, width, height, buffer, activeCubeFace, level);
        };
        asAny(proto.readRenderTargetPixels).__effectsManagerPatched = true;
      }
    }

    // Also attempt to patch any global WebGLRenderer constructor present
    try {
      const g: any = asAny(globalThis);
      if (
        g.WebGLRenderer &&
        g.WebGLRenderer.prototype &&
        typeof g.WebGLRenderer.prototype.readRenderTargetPixels === 'function' &&
        !asAny(g.WebGLRenderer.prototype.readRenderTargetPixels).__effectsManagerPatched
      ) {
        const orig2 = g.WebGLRenderer.prototype.readRenderTargetPixels;
        g.WebGLRenderer.prototype.readRenderTargetPixels = function (
          renderTarget: any,
          x: number,
          y: number,
          width: number,
          height: number,
          buffer: any,
          activeCubeFace?: number,
          level?: number,
        ) {
          try {
            if (renderTarget && renderTarget.texture) {
              const temp = getTempRT(renderTarget);
              if (temp) {
                try {
                  logger.info('[EffectsManager] global prototype wrapper: using temp RT');
                } catch (_e) {
                  void _e; /* no-op */
                }
                blitToTemp(this as WebGLRenderer, renderTarget, temp);
                return orig2.call(this, temp, x, y, width, height, buffer, activeCubeFace, level);
              }
            }
          } catch (_e) {
            void _e; // ignore
          }
          return orig2.call(this, renderTarget, x, y, width, height, buffer, activeCubeFace, level);
        };
        asAny(g.WebGLRenderer.prototype.readRenderTargetPixels).__effectsManagerPatched = true;
      }
    } catch (_e) {
      void _e; // ignore
    }
  } catch (_e) {
    void _e; // best-effort
  }

  // Expose a global helper so callers (or early bootstrap code) can apply
  // the same global-level patches before createEffectsManager is invoked.
  try {
    const globalAny: any = asAny(globalThis);
    if (!globalAny.__applyEffectsManagerGlobalPatches) {
      globalAny.__applyEffectsManagerGlobalPatches = () => {
        try {
          if (globalAny.__effectsManagerGLPatched) return;
          const wrap = (proto: any, name: string) => {
            if (!proto || typeof proto[name] !== 'function') return;
            const orig = proto[name];
            proto[name] = function (...args: any[]) {
              try {
                const stack = new Error().stack || '';
                logger.info(
                  '[EffectsManager][GL] readPixels called, stack:',
                  stack.split('\n').slice(0, 4).join(' | '),
                );
              } catch (_e) {
                void _e; /* no-op */
              }
              return orig.apply(this, asAny(args));
            };
          };
          wrap(asAny(globalThis).WebGLRenderingContext?.prototype, 'readPixels');
          wrap(asAny(globalThis).WebGL2RenderingContext?.prototype, 'readPixels');
          globalAny.__effectsManagerGLPatched = true;
        } catch (_e) {
          void _e; /* ignore */
        }
        // Note: temporary early-add instrumentation removed.
      };
    }
  } catch (_e) {
    void _e; /* ignore */
  }

  // Safety patch: postprocessing's DepthCopyPass / DepthPickingPass perform
  // synchronous reads (renderer.readRenderTargetPixels) which can cause
  // GPU stalls and driver warnings when the readback happens while the
  // framebuffer/texture is still active. If possible, patch the pass so it
  // uses the non-blocking readRenderTargetPixelsAsync API.
  try {
    const DepthCopyPass =
      ppAny.DepthCopyPass || ppAny.DepthSavePass || ppAny.DepthSavePass?.DepthCopyPass;
    const _DepthCopyMode = ppAny.DepthCopyMode || ppAny.DepthCopyMode;
    if (DepthCopyPass && typeof DepthCopyPass.prototype.render === 'function') {
      const originalRender = DepthCopyPass.prototype.render;
      try {
        logger.info(
          '[EffectsManager] Patched DepthCopyPass.render to use async read when available',
        );
      } catch (_e) {
        void _e; /* ignore logging errors */
      }

      // use module-level unpack helper

      DepthCopyPass.prototype.render = function (
        this: any,
        rendererArg: WebGLRenderer,
        inputBuffer?: any,
        delta?: number,
      ) {
        // Temporarily stub out the synchronous read to avoid blocking inside
        // the original implementation. Then perform a non-blocking read
        // ourselves if a callback/request is pending.
        const rendererRead = asAny(rendererArg).readRenderTargetPixels;
        const _hasAsyncRead = typeof asAny(rendererArg).readRenderTargetPixelsAsync === 'function';

        // Replace sync read with a no-op while originalRender executes.
        asAny(rendererArg).readRenderTargetPixels = function () {
          /* noop to avoid sync read */
        };
        try {
          originalRender.call(this, rendererArg, inputBuffer, delta);
        } finally {
          // restore original
          asAny(rendererArg).readRenderTargetPixels = rendererRead;
        }

        // If the pass created a callback (DepthPickingPass usage), perform
        // the read asynchronously and resolve the callback. Read from a
        // temporary copy of the renderTarget to avoid feedback loops.
        try {
          if (this.callback) {
            const renderTarget = this.renderTarget;
            const pixelBuffer = this.pixelBuffer || new Uint8Array(4);
            const packed =
              renderTarget && renderTarget.texture && renderTarget.texture.type !== FloatType;

            let x = 0,
              y = 0;
            try {
              const texelPosition = (this.fullscreenMaterial &&
                asAny(this.fullscreenMaterial).texelPosition) || { x: 0.5, y: 0.5 };
              if (renderTarget && renderTarget.width)
                x = Math.round(texelPosition.x * renderTarget.width);
              if (renderTarget && renderTarget.height)
                y = Math.round(texelPosition.y * renderTarget.height);
            } catch (_e) {
              void _e; // fall back to 0,0
            }

            const temp = getTempRT(renderTarget);

            if (temp) {
              try {
                logger.info(
                  '[EffectsManager] depth-read temp=true async=' +
                    _hasAsyncRead +
                    ' src=' +
                    (renderTarget && renderTarget.texture && renderTarget.texture.name),
                );
              } catch (_e) {
                void _e; /* no-op */
              }
              blitToTemp(rendererArg, renderTarget, temp);
              // Use the centralized safe read helper which will prefer async API
              // and otherwise perform a deferred sync read. This makes the
              // behavior deterministic and avoids inlined direct sync reads.
              try {
                readPixelsSafe(rendererArg, temp, x, y, 1, 1, pixelBuffer)
                  .then(() => {
                    try {
                      const value = packed ? unpackRGBAToDepth(pixelBuffer) : pixelBuffer[0];
                      try {
                        this.callback(value);
                      } catch (_e) {
                        void _e; /* ignore callback errors */
                      }
                    } finally {
                      this.callback = null;
                    }
                  })
                  .catch(() => {
                    // If safe-read fails unexpectedly, clear the callback to avoid leaks
                    this.callback = null;
                  });
              } catch (_err) {
                void _err;
                this.callback = null;
              }
            } else {
              // No temp RT available: fall back to previous behavior.
              try {
                logger.info(
                  '[EffectsManager] depth-read temp=false async=' +
                    _hasAsyncRead +
                    ' src=' +
                    (renderTarget && renderTarget.texture && renderTarget.texture.name),
                );
              } catch (_e) {
                void _e; /* no-op */
              }
              if (_hasAsyncRead) {
                asAny(rendererArg)
                  .readRenderTargetPixelsAsync(renderTarget, x, y, 1, 1, pixelBuffer)
                  .then(() => {
                    try {
                      const value = packed ? unpackRGBAToDepth(pixelBuffer) : pixelBuffer[0];
                      try {
                        this.callback(value);
                      } catch (_e) {
                        void _e; /* ignore callback errors */
                      }
                    } finally {
                      this.callback = null;
                    }
                  })
                  .catch(() => {
                    // Async read failed — defer the sync read
                    try {
                      setTimeout(() => {
                        try {
                          rendererRead.call(rendererArg, renderTarget, x, y, 1, 1, pixelBuffer);
                          const value = packed ? unpackRGBAToDepth(pixelBuffer) : pixelBuffer[0];
                          try {
                            this.callback(value);
                          } catch (_e) {
                            void _e; /* ignore */
                          }
                        } catch (_err) {
                          void _err; // swallow
                        } finally {
                          this.callback = null;
                        }
                      }, 0);
                    } catch (_err) {
                      void _err;
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
                      try {
                        this.callback(value);
                      } catch (_e) {
                        void _e; /* ignore */
                      }
                    } catch (_err) {
                      void _err; // swallow
                    } finally {
                      this.callback = null;
                    }
                  }, 0);
                } catch (_err) {
                  void _err;
                  this.callback = null;
                }
              }
            }
          }
        } catch (_err) {
          void _err; // Ensure read errors don't break rendering
        }
      };
    }
  } catch (_e) {
    void _e; // best-effort patch; silently ignore if anything unexpected happens
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
        radius: 0.8,
      });
      const bloomPass = new EffectPass(camera, bloomEffect);
      bloomPass.renderToScreen = false;
      composer.addPass(bloomPass);
    }

    // Motion blur for dynamic camera movement (only add if enabled)
    if (ENABLE_MOTION_BLUR && MotionBlurEffect) {
      motionBlurEffect = new MotionBlurEffect({
        intensity: 0.2,
        samples: 16,
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
        bokehScale: 2.0,
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
        adaptationRate: 1.0,
      });
      const tonePass = new EffectPass(camera, tone);
      tonePass.renderToScreen = true;
      composer.addPass(tonePass);
    }
  } catch (_e) {
    void _e; // If any pass fails, fall back to just the render pass
    try {
      if (RenderPass) composer.addPass(new RenderPass(scene, camera));
    } catch (_e) {
      void _e; /* ignore */
    }
  }

  // Instance-level patch: some builds inline/duplicate postprocessing so
  // patching the prototype may not affect the actually used instances.
  // Iterate the composer's passes and wrap any pass that appears to use
  // a pixel read/callback (DepthPickingPass style) to replace the
  // synchronous read with an async read when available.
  try {
    const _hasAsyncRead = typeof asAny(renderer).readRenderTargetPixelsAsync === 'function';
    // reuse module-level unpack helper

    const patchInstance = (pass: any) => {
      if (!pass || typeof pass.render !== 'function') return;
      // Heuristic: DepthPickingPass exposes `callback` and `renderTarget`/`pixelBuffer`.
      if (!('callback' in pass) && !('pixelBuffer' in pass) && !('renderTarget' in pass)) return;

      const original = pass.render.bind(pass);
      pass.render = function (rend: WebGLRenderer, inputBuffer?: any, delta?: number) {
        const rendererRead = asAny(rend).readRenderTargetPixels;
        // noop sync read during original render to avoid immediate ReadPixels
        asAny(rend).readRenderTargetPixels = function () {
          /* noop */
        };
        try {
          original(rend, inputBuffer, delta);
        } finally {
          asAny(rend).readRenderTargetPixels = rendererRead;
        }

        try {
          if (this.callback) {
            const renderTarget = this.renderTarget;
            const pixelBuffer = this.pixelBuffer || new Uint8Array(4);
            const packed =
              renderTarget && renderTarget.texture && renderTarget.texture.type !== FloatType;

            let x = 0,
              y = 0;
            try {
              const texelPosition = (this.fullscreenMaterial &&
                this.fullscreenMaterial.texelPosition) || { x: 0.5, y: 0.5 };
              if (renderTarget && renderTarget.width)
                x = Math.round(texelPosition.x * renderTarget.width);
              if (renderTarget && renderTarget.height)
                y = Math.round(texelPosition.y * renderTarget.height);
            } catch (_e) {
              void _e; // fall back to 0,0
            }

            // Use centralized safe-read helper for instance patch too.
            try {
              readPixelsSafe(rend, renderTarget, x, y, 1, 1, pixelBuffer)
                .then(() => {
                  try {
                    const value = packed ? unpackRGBAToDepth(pixelBuffer) : pixelBuffer[0];
                    try {
                      this.callback(value);
                    } catch (_e) {
                      void _e; /* ignore callback errors */
                    }
                  } finally {
                    this.callback = null;
                  }
                })
                .catch(() => {
                  this.callback = null;
                });
            } catch (_err) {
              void _err;
              this.callback = null;
            }
          }
        } catch (_err) {
          void _err; // never let read errors break the render loop
        }
      };
    };

    try {
      const passes = asAny(composer).passes || [];
      passes.forEach(patchInstance);
    } catch (_e) {
      void _e; // ignore
    }
    // Also patch EffectComposer.prototype.addPass so any passes added later
    // (e.g. by other modules or delayed initialization) will also be wrapped.
    try {
      const composerProto: any = (EffectComposer && asAny(EffectComposer).prototype) || null;
      if (composerProto && typeof composerProto.addPass === 'function') {
        const originalAddPass = composerProto.addPass;
        composerProto.addPass = function (this: any, pass: any) {
          try {
            originalAddPass.call(this, pass);
          } catch (_e) {
            void _e; /* still try to patch instance */
          }
          try {
            patchInstance(pass);
          } catch (_err) {
            void _err; /* ignore patch errors */
          }
        };
      }
    } catch (_e) {
      void _e; // best-effort
    }
  } catch (_e) {
    void _e; // best-effort
  }

  return {
    initDone: true,
    render(dt: number) {
      // Import and call ship instancer methods before rendering
      try {
        const { shipInstancer } = require('./shipInstancer.js');
        if (shipInstancer && camera) {
          shipInstancer.cull(camera);
          shipInstancer.sync();
        }
      } catch (_e) {
        void _e; /* ignore if ship instancer not available */
      }

      try {
        asAny(composer).render(dt);
      } catch (_e) {
        void _e;
        try {
          asAny(composer).render();
        } catch (_) {
          void _; /* ignore */
        }
      }
    },
    resize(width: number, height: number) {
      try {
        composer.setSize(width, height);
      } catch (_e) {
        void _e; /* ignore */
      }
    },
    dispose() {
      try {
        composer.dispose?.();
      } catch (_e) {
        void _e; /* ignore */
      }
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
    },
    addHitSpark(position: { x: number; y: number; z: number }, opts?: { intensity?: number }) {
      // Small, cheap visual: spawn a temporary additive sprite at the hit position
      try {
        const intensity = opts?.intensity ?? 1;
        const size = Math.max(0.2, Math.min(1.5, 0.3 * intensity));

        // Create simple sprite-like quad using MeshBasicMaterial with additive blending
        const geom = new three.PlaneGeometry(size, size);
        const mat = new three.MeshBasicMaterial({
          color: new three.Color(1, 0.85, 0.5),
          transparent: true,
          opacity: 0.9 * Math.min(1, intensity * 0.5),
          blending: three.AdditiveBlending,
          depthWrite: false,
        });
        const mesh = new three.Mesh(geom, mat);
        try {
          mesh.position.set(position.x, position.y, position.z);
        } catch (_e) {
          void _e;
        }

        // Add briefly to the scene so composer will pick it up
        try {
          scene.add(mesh);
        } catch (_e) {
          void _e;
        }

        // Simple fade-out animation using setTimeout (keep dependency-free)
        const lifetime = 120; // ms
        const fadeSteps = 6;
        let step = 0;
        const interval = Math.max(8, Math.floor(lifetime / fadeSteps));
        const t = setInterval(() => {
          step += 1;
          try {
            mat.opacity = Math.max(0, mat.opacity - 0.9 / fadeSteps);
          } catch (_e) {
            void _e;
          }
          if (step >= fadeSteps) {
            clearInterval(t);
            try {
              scene.remove(mesh);
            } catch (_e) {
              void _e;
            }
            try {
              geom.dispose();
              mat.dispose();
            } catch (_e) {
              void _e;
            }
          }
        }, interval);
      } catch (_e) {
        void _e;
      }
    },
  };
}

// Exported helper to apply global instrumentation and prototype patches
// early in the application lifecycle. This function is idempotent and
// safe to call multiple times.
export function applyGlobalPatches() {
  try {
    const globalAny: any = asAny(globalThis);
    if (globalAny.__effectsManagerGlobalPatchesApplied) return;

    const wrapGLRead = (proto: any, name: string) => {
      if (!proto || typeof proto[name] !== 'function') return;
      const orig = proto[name];
      proto[name] = function (...args: any[]) {
        try {
          const stack = new Error().stack || '';
          logger.info(
            '[EffectsManager][GL] readPixels called, stack:',
            stack.split('\n').slice(0, 4).join(' | '),
          );
        } catch (_e) {
          void _e; /* no-op */
        }
        return orig.apply(this, asAny(args));
      };
    };

    try {
      wrapGLRead(asAny(globalThis).WebGLRenderingContext?.prototype, 'readPixels');
    } catch (_e) {
      void _e; /* no-op */
    }
    try {
      wrapGLRead(asAny(globalThis).WebGL2RenderingContext?.prototype, 'readPixels');
    } catch (_e) {
      void _e; /* no-op */
    }

    // Patch three.js prototype if available
    try {
      if (three && asAny(three).WebGLRenderer && asAny(three).WebGLRenderer.prototype) {
        const proto = asAny(three).WebGLRenderer.prototype;
        if (
          typeof proto.readRenderTargetPixels === 'function' &&
          !asAny(proto.readRenderTargetPixels).__effectsManagerPatched
        ) {
          const orig = proto.readRenderTargetPixels;
          proto.readRenderTargetPixels = function (
            renderTarget: any,
            x: number,
            y: number,
            width: number,
            height: number,
            buffer: any,
            activeCubeFace?: number,
            level?: number,
          ) {
            try {
              if (renderTarget && renderTarget.texture) {
                const temp = getTempRT(renderTarget);
                if (temp) {
                  try {
                    logger.info('[EffectsManager] prototype wrapper: using temp RT');
                  } catch (_e) {
                    void _e; /* no-op */
                  }
                  blitToTemp(this as WebGLRenderer, renderTarget, temp);
                  return orig.call(this, temp, x, y, width, height, buffer, activeCubeFace, level);
                }
              }
            } catch (_e) {
              void _e; /* no-op */
            }
            return orig.call(
              this,
              renderTarget,
              x,
              y,
              width,
              height,
              buffer,
              activeCubeFace,
              level,
            );
          };
          asAny(proto.readRenderTargetPixels).__effectsManagerPatched = true;
        }
      }
    } catch (_e) {
      void _e; /* ignore */
    }

    // Patch any global WebGLRenderer constructor
    try {
      const g: any = asAny(globalThis);
      if (
        g.WebGLRenderer &&
        g.WebGLRenderer.prototype &&
        typeof g.WebGLRenderer.prototype.readRenderTargetPixels === 'function' &&
        !asAny(g.WebGLRenderer.prototype.readRenderTargetPixels).__effectsManagerPatched
      ) {
        const orig2 = g.WebGLRenderer.prototype.readRenderTargetPixels;
        g.WebGLRenderer.prototype.readRenderTargetPixels = function (
          renderTarget: any,
          x: number,
          y: number,
          width: number,
          height: number,
          buffer: any,
          activeCubeFace?: number,
          level?: number,
        ) {
          try {
            if (renderTarget && renderTarget.texture) {
              const temp = getTempRT(renderTarget);
              if (temp) {
                try {
                  logger.info('[EffectsManager] global prototype wrapper: using temp RT');
                } catch (_e) {
                  void _e; /* no-op */
                }
                blitToTemp(this as WebGLRenderer, renderTarget, temp);
                return orig2.call(this, temp, x, y, width, height, buffer, activeCubeFace, level);
              }
            }
          } catch (_e) {
            void _e; /* no-op */
          }
          return orig2.call(this, renderTarget, x, y, width, height, buffer, activeCubeFace, level);
        };
        asAny(g.WebGLRenderer.prototype.readRenderTargetPixels).__effectsManagerPatched = true;
      }
    } catch (_e) {
      void _e; /* ignore */
    }

    // Also install early Object3D.add wrapper now so calling
    // applyGlobalPatches() from bootstrap will activate it before
    // renderer modules create scene objects.
    // Note: temporary early-add instrumentation removed.

    globalAny.__effectsManagerGlobalPatchesApplied = true;
  } catch (_e) {
    void _e; /* ignore */
  }
}
