import {
  ClampToEdgeWrapping,
  DataTexture,
  LinearFilter,
  NearestFilter,
  RepeatWrapping,
  RGBAFormat,
  ShaderMaterial,
  SRGBColorSpace,
  Texture,
  UnsignedByteType,
  Vector3,
  Vector4,
} from 'three';
import fragmentShader from './shaders/mainsequencestar.glsl';
import vertexShader from './shaders/starDisk.vertex.glsl';

export interface StarDiskHazeUniformInput {
  taperStrength?: number;
  edgeFadeThreshold?: number;
  edgeExponent?: number;
}

export interface StarDiskHazeUniformResult {
  fade: number;
  edgeThreshold: number;
  edgeExponent: number;
}

export interface StarDiskBoundaryUniformInput {
  featherStart?: number;
  featherExponent?: number;
  alphaFloor?: number;
}

export interface StarDiskBoundaryUniformResult {
  start: number;
  exponent: number;
  alphaFloor: number;
  reserved: number;
}

export interface MainSequenceStarMaterialOptions {
  organic: Texture | null;
  noise: Texture | null;
}

export interface MainSequenceStarUniformUpdate {
  time: number;
  resolution: { width: number; height: number };
  organic?: Texture | null;
  noise?: Texture | null;
  /** Camera roll angle around the view direction in radians. Optional; defaults to 0. */
  cameraRoll?: number;
  /** Star-fixed north angle in radians for inner-UV orientation (0 aligns to +U axis). */
  starNorth?: number;
  /** Camera-to-disk alignment encoded as (planeX, planeY, facingCos). */
  viewAlignment?: { x: number; y: number; z: number };
  /** Optional haze taper configuration controlling rim attenuation. */
  haze?: StarDiskHazeUniformInput;
  /** Optional boundary feather settings for alpha fade near the rim. */
  boundary?: StarDiskBoundaryUniformInput;
}

const DEFAULT_RESOLUTION = new Vector3(1, 1, 1);

const DEFAULT_BOUNDARY_SETTINGS: Required<StarDiskBoundaryUniformInput> = Object.freeze({
  featherStart: 0.92,
  featherExponent: 2,
  alphaFloor: 0,
});

const LEGACY_BOUNDARY_SETTINGS = Object.freeze({
  start: 0.999,
  exponent: 1,
  alphaFloor: 1,
});

const DEFAULT_BOUNDARY_VECTOR = new Vector4(
  DEFAULT_BOUNDARY_SETTINGS.featherStart,
  DEFAULT_BOUNDARY_SETTINGS.featherExponent,
  DEFAULT_BOUNDARY_SETTINGS.alphaFloor,
  0,
);

const FALLBACK_ORGANIC = (() => {
  const data = new Uint8Array([
    255, 220, 140, 255,
    240, 180, 80, 255,
    255, 200, 100, 255,
    250, 160, 60, 255,
    200, 120, 40, 255,
    150, 80, 30, 255,
    180, 100, 45, 255,
    220, 140, 70, 255,
    80, 40, 20, 255,
    60, 30, 15, 255,
    100, 50, 25, 255,
    120, 60, 30, 255,
    40, 20, 10, 255,
    160, 80, 20, 255,
    90, 45, 15, 255,
    200, 100, 30, 255,
  ]);
  const texture = new DataTexture(data, 4, 4, RGBAFormat, UnsignedByteType);
  texture.name = 'MainSequenceOrganicFallback';
  texture.wrapS = RepeatWrapping;
  texture.wrapT = ClampToEdgeWrapping;
  texture.minFilter = LinearFilter;
  texture.magFilter = LinearFilter;
  texture.colorSpace = SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
})();

const FALLBACK_NOISE = (() => {
  const data = new Uint8Array([
    255, 200, 100, 255,
    80, 40, 20, 255,
    220, 160, 60, 255,
    40, 20, 10, 255,
    200, 120, 40, 255,
    60, 30, 15, 255,
    180, 140, 80, 255,
    100, 50, 25, 255,
    240, 180, 90, 255,
    70, 35, 18, 255,
    160, 100, 50, 255,
    90, 45, 22, 255,
    210, 140, 70, 255,
    50, 25, 12, 255,
    150, 90, 45, 255,
    120, 70, 35, 255,
  ]);
  const texture = new DataTexture(data, 4, 4, RGBAFormat, UnsignedByteType);
  texture.name = 'MainSequenceNoiseFallback';
  texture.wrapS = RepeatWrapping;
  texture.wrapT = RepeatWrapping;
  texture.minFilter = NearestFilter;
  texture.magFilter = NearestFilter;
  texture.generateMipmaps = false;
  texture.needsUpdate = true;
  return texture;
})();

const resolveTexture = (texture: Texture | null | undefined, fallback: Texture): Texture => texture ?? fallback;

interface MainSequenceUniformMap {
  iTime: { value: number };
  iResolution: { value: Vector3 };
  iChannel0: { value: Texture };
  iChannel1: { value: Texture };
  iCameraRoll: { value: number };
  iStarNorth: { value: number };
  iViewAlignment: { value: Vector3 };
  iHazeParams: { value: Vector3 };
  iBoundaryFeather: { value: Vector4 };
}

const DEFAULT_HAZE_SETTINGS: Required<StarDiskHazeUniformInput> = Object.freeze({
  taperStrength: 0.85,
  edgeFadeThreshold: 0.3,
  edgeExponent: 2,
});

const clamp01 = (value: number): number => Math.min(Math.max(value, 0), 1);

export function deriveBoundaryUniform(input?: StarDiskBoundaryUniformInput): StarDiskBoundaryUniformResult {
  const disableByStart = Number.isFinite(input?.featherStart as number)
    && (input?.featherStart as number) >= 0.999;
  const disableByFloor = Number.isFinite(input?.alphaFloor as number)
    && (input?.alphaFloor as number) >= 0.99;
  if (disableByStart || disableByFloor) {
    return {
      start: LEGACY_BOUNDARY_SETTINGS.start,
      exponent: LEGACY_BOUNDARY_SETTINGS.exponent,
      alphaFloor: LEGACY_BOUNDARY_SETTINGS.alphaFloor,
      reserved: 0,
    };
  }

  const rawStart = Number.isFinite(input?.featherStart as number)
    ? (input?.featherStart as number)
    : DEFAULT_BOUNDARY_SETTINGS.featherStart;
  const start = Math.min(Math.max(rawStart, 0.6), 0.999);
  const rawExponent = Number.isFinite(input?.featherExponent as number)
    ? (input?.featherExponent as number)
    : DEFAULT_BOUNDARY_SETTINGS.featherExponent;
  const exponent = Math.min(Math.max(rawExponent, 0.5), 6);
  const rawFloor = Number.isFinite(input?.alphaFloor as number)
    ? (input?.alphaFloor as number)
    : DEFAULT_BOUNDARY_SETTINGS.alphaFloor;
  const alphaFloor = Math.min(Math.max(rawFloor, 0), 0.3);

  return {
    start,
    exponent,
    alphaFloor,
    reserved: 0,
  };
}

export function deriveHazeUniform(
  facingCos: number,
  input?: StarDiskHazeUniformInput,
): StarDiskHazeUniformResult {
  const rawStrength = Number.isFinite(input?.taperStrength as number)
    ? (input?.taperStrength as number)
    : DEFAULT_HAZE_SETTINGS.taperStrength;
  const strength = clamp01(rawStrength);
  const rawThreshold = Number.isFinite(input?.edgeFadeThreshold as number)
    ? (input?.edgeFadeThreshold as number)
    : DEFAULT_HAZE_SETTINGS.edgeFadeThreshold;
  const threshold = Math.min(Math.max(rawThreshold, 0), 0.9);
  const rawExponent = Number.isFinite(input?.edgeExponent as number)
    ? (input?.edgeExponent as number)
    : DEFAULT_HAZE_SETTINGS.edgeExponent;
  const exponent = Math.min(Math.max(rawExponent, 0.5), 6);

  const safeFacing = clamp01(Number.isFinite(facingCos) ? facingCos : 1);
  const denom = Math.max(1 - threshold, 1e-3);
  const normalized = Math.pow(clamp01((safeFacing - threshold) / denom), exponent);
  const horizonFloor = clamp01(1 - strength);
  const fade = Math.min(Math.max(horizonFloor + (1 - horizonFloor) * normalized, 0), 1.1);

  return {
    fade,
    edgeThreshold: threshold,
    edgeExponent: exponent,
  };
}

export function createMainSequenceStarMaterial(options: MainSequenceStarMaterialOptions): ShaderMaterial {
  const organicTexture = resolveTexture(options.organic, FALLBACK_ORGANIC);
  const noiseTexture = resolveTexture(options.noise, FALLBACK_NOISE);

  const material = new ShaderMaterial({
    name: 'MainSequenceStarMaterial',
    transparent: true,
    depthWrite: false,
    vertexShader,
    fragmentShader,
    uniforms: {
      iTime: { value: 0 },
      iResolution: { value: DEFAULT_RESOLUTION.clone() },
      iChannel0: { value: organicTexture },
      iChannel1: { value: noiseTexture },
      iCameraRoll: { value: 0 },
      iStarNorth: { value: 0 },
      iViewAlignment: { value: new Vector3(0, 0, 1) },
      iHazeParams: { value: new Vector3(1, DEFAULT_HAZE_SETTINGS.edgeFadeThreshold, DEFAULT_HAZE_SETTINGS.edgeExponent) },
      iBoundaryFeather: { value: DEFAULT_BOUNDARY_VECTOR.clone() },
    },
  });

  // DEV: one-time shader / program logging to help debug missing rendering.
  // Logs truncated shader sources at compile time and polls three.js renderer
  // internals for the WebGL program to print getProgramInfoLog and gl.getError.
  // This is guarded to run only in non-production builds and removes itself
  // after reporting to avoid log spam.
  const _urlSearch = typeof window !== 'undefined' ? window.location.search : '';
  const _enableShaderDevLogging = process.env.NODE_ENV !== 'production' || /[?&]copilot_debug=1/.test(_urlSearch);
  if (_enableShaderDevLogging) {
     let logged = false;
     try {
       material.onBeforeCompile = (shader, renderer) => {
         // Allow the onBeforeCompile to run again if automation requests a
         // forced opaque shader (even if we've previously logged).
         const _win = (typeof window !== 'undefined') ? (window as Window & { __copilot_forceStarOpaque?: boolean }) : undefined;
         if (logged && !(_win && _win.__copilot_forceStarOpaque)) return;
         logged = true;

         try {
           console.groupCollapsed('[STARDEV] MainSequenceStar shader compile info');
           console.log('[STARDEV] vertex shader (trunc):', (shader.vertexShader || '').slice(0, 1024));
           console.log('[STARDEV] fragment shader (trunc):', (shader.fragmentShader || '').slice(0, 1024));

           // DEV: Indicate compilation attempt immediately so it is visible
           // even when console output is noisy or the GL program isn't yet
           // available. This flag + DOM node are transient and only used
           // for debugging.
           try {
             (window as unknown as { __STAR_COMPILED?: boolean }).__STAR_COMPILED = true;
             try {
               // Persistent marker for automation checks
               if (typeof localStorage !== 'undefined' && localStorage) {
                 localStorage.setItem('copilot_star_compiled', String(Date.now()));
               }
             } catch { void 0; }
             if (typeof document !== 'undefined') {
               try {
                 document.documentElement.setAttribute('data-star-compiled', '1');
               } catch { void 0; }
               const id = 'copilot-star-compiled-indicator';
               if (!document.getElementById(id)) {
                 const el = document.createElement('div');
                 el.id = id;
                 el.textContent = 'STAR COMPILE STARTED';
                 el.style.cssText = 'position:fixed; right:12px; bottom:12px; padding:6px 10px; background:rgba(59,130,246,0.95); color:white; font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif; font-size:12px; border-radius:6px; box-shadow:0 2px 6px rgba(0,0,0,0.35); z-index:9999999;';
                 document.body.appendChild(el);
                 setTimeout(() => { try { el.remove(); } catch { /* ignore */ } }, 4000);
               }
             }
           } catch (flagErr) {
             console.warn('[STARDEV] failed to create DOM compile-start indicator', flagErr);
           }
         } catch (e) {
           console.warn('[STARDEV] failed to print shader source', e);
         }

         try {
           // Access renderer internals carefully via `unknown` casts to avoid `any`.
           const props = (renderer as unknown as { properties?: { get: (k: ShaderMaterial) => unknown } }).properties;
           const start = Date.now();
           const maxWaitMs = 10000; // stop polling after 10s
           const pollInterval = 200;

           // Persistent markers: write an unconditional flag to localStorage
           // and a global window flag right when compilation is attempted.
           try { (window as unknown as { __STAR_COMPILE_ATTEMPTED?: string }).__STAR_COMPILE_ATTEMPTED = String(Date.now()); } catch { void 0; }
           try { if (typeof localStorage !== 'undefined') { localStorage.setItem('copilot_star_compiled', String(Date.now())); } } catch { void 0; }

           const handle = setInterval(() => {
             try {
               const matProp = props?.get(material) as unknown;
               const programField = (matProp as { program?: unknown } | undefined)?.program;

               let webglProgram: WebGLProgram | null = null;
               if (programField && typeof programField === 'object') {
                 // programField may itself be the WebGLProgram or an object with `.program`.
                 webglProgram = (programField as { program?: WebGLProgram }).program ?? (programField as unknown as WebGLProgram);
               } else if (programField && typeof programField !== 'object') {
                 // Fallback if programField is a primitive (unlikely) — try casting.
                 webglProgram = programField as unknown as WebGLProgram;
               }

               if (webglProgram) {
                 try {
                  // Dump final material state when program is found so automation can inspect runtime uniforms
                  try { if (_enableShaderDevLogging) dumpMaterialState(); } catch { /* ignore */ }
                   const gl = renderer.getContext();
                   const programInfo = gl.getProgramInfoLog(webglProgram);
                   if (programInfo && programInfo.length) console.log('[STARDEV] GL Program InfoLog:', programInfo);
                   const err = gl.getError();
                   if (err !== 0) console.log('[STARDEV] GL getError:', err);

                  // Also record deterministic program metadata to the global debug log
                  try {
                    const win = (window as unknown as { __copilot_glLogs?: Array<unknown> });
                    if (win && win.__copilot_glLogs) {
                      const linkStatus = Boolean(gl.getProgramParameter(webglProgram, (gl as WebGLRenderingContext).LINK_STATUS));
                      const activeUniforms = Number(gl.getProgramParameter(webglProgram, (gl as WebGLRenderingContext).ACTIVE_UNIFORMS));
                      const activeAttributes = Number(gl.getProgramParameter(webglProgram, (gl as WebGLRenderingContext).ACTIVE_ATTRIBUTES));
                      const uniforms: Array<{ name: string; size: number; type: number } | null> = [];
                      for (let i = 0; i < Math.min(activeUniforms, 200); i++) {
                        try {
                          const u = gl.getActiveUniform(webglProgram, i);
                          uniforms.push(u ? { name: u.name, size: u.size, type: u.type } : null);
                        } catch {
                          uniforms.push(null);
                        }
                      }
                      const attributes: Array<{ name: string; size: number; type: number } | null> = [];
                      for (let i = 0; i < Math.min(activeAttributes, 200); i++) {
                        try {
                          const a = gl.getActiveAttrib(webglProgram, i);
                          attributes.push(a ? { name: a.name, size: a.size, type: a.type } : null);
                        } catch {
                          attributes.push(null);
                        }
                      }
                      try {
                        win.__copilot_glLogs.push({ time: Date.now(), type: 'programMetadataViaPoller', details: { linkStatus, activeUniforms, activeAttributes, uniforms, attributes } });
                      } catch {
                        // Ignore push failures
                      }
                    }
                  } catch {
                    // swallow metadata push errors — non-critical
                  }

                   // DEV: expose a small DOM-visible indicator so users can
                   // visually confirm the shader compiled/linked even when
                   // console logs are noisy. Set a global flag and insert
                   // a transient overlay node (removed after 4s).
                   try {
                     (window as unknown as { __STAR_COMPILED?: boolean }).__STAR_COMPILED = true;
                     if (typeof document !== 'undefined') {
                       const id = 'copilot-star-compiled-indicator';
                       if (!document.getElementById(id)) {
                         const el = document.createElement('div');
                         el.id = id;
                         el.textContent = 'STAR COMPILED';
                         el.style.cssText = 'position:fixed; right:12px; bottom:12px; padding:6px 10px; background:rgba(16,185,129,0.95); color:white; font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif; font-size:12px; border-radius:6px; box-shadow:0 2px 6px rgba(0,0,0,0.35); z-index:9999999;';
                         document.body.appendChild(el);
                         setTimeout(() => { try { el.remove(); } catch { /* ignore */ } }, 4000);
                       }
                     }
                   } catch (domErr) {
                     console.warn('[STARDEV] failed to create DOM compile indicator', domErr);
                   }
                 } catch (inner) {
                   console.warn('[STARDEV] failed to read GL program/log', inner);
                 }
                clearInterval(handle);
                console.groupEnd();
                return;
               }

               if (Date.now() - start > maxWaitMs) {
                 clearInterval(handle);
                 console.warn('[STARDEV] timed out waiting for compiled WebGL program (dev-only)');
                 console.groupEnd();
               }
             } catch (pollErr) {
               // Continue polling; don't throw. Keep surface-level warning for debugging.
               console.warn('[STARDEV] poll error while waiting for program', pollErr);
             }
           }, pollInterval);
         } catch (e) {
           console.warn('[STARDEV] failed to install program poller', e);
           console.groupEnd();
         }
       };
     } catch (e) {
       console.warn('[STARDEV] failed to attach onBeforeCompile logging', e);
     }
   }

  // DEV: helper to snapshot material uniforms and texture bindings for automation
  const dumpMaterialState = () => {
    try {
      const win = (typeof window !== 'undefined') ? (window as Window & { __copilot_starUniforms?: Array<unknown> }) : undefined;
      if (!win) return;
      win.__copilot_starUniforms = win.__copilot_starUniforms || [];

      const uniformsMap: Record<string, unknown> = {};
      try {
        const u = material.uniforms as unknown as Record<string, { value: unknown }>;
        for (const k of Object.keys(u)) {
          const v = u[k]?.value as unknown;
           if (v == null) {
             uniformsMap[k] = null;
           } else if (typeof v === 'number' || typeof v === 'string' || typeof v === 'boolean') {
             uniformsMap[k] = v;
           } else {
            const maybeArrProvider = v as unknown as { toArray?: unknown };
            if (maybeArrProvider && typeof maybeArrProvider.toArray === 'function') {
              try { uniformsMap[k] = (maybeArrProvider.toArray as Function).call(v); } catch { uniformsMap[k] = String(v); }
            } else if ((v as Texture) instanceof Texture) {
              const tex = v as Texture;
              const img = (tex as unknown as { image?: { width?: number; height?: number } }).image || null;
              uniformsMap[k] = {
                name: tex.name || null,
                width: img && img.width ? img.width : null,
                height: img && img.height ? img.height : null,
                wrapS: tex.wrapS,
                wrapT: tex.wrapT,
                minFilter: tex.minFilter,
                magFilter: tex.magFilter,
                generateMipmaps: Boolean((tex as unknown as { generateMipmaps?: boolean }).generateMipmaps),
                colorSpace: (tex as unknown as { colorSpace?: unknown }).colorSpace || null,
              };
            } else if (Array.isArray(v)) {
              uniformsMap[k] = v.slice(0, 10);
            } else {
              uniformsMap[k] = String(v);
            }
          }
         }
       } catch {
         // ignore uniform serialization failures
       }

      const snapshot = {
        time: Date.now(),
        materialName: material.name,
        materialSettings: {
          transparent: Boolean(material.transparent),
          depthWrite: Boolean(material.depthWrite),
          depthTest: Boolean((material as unknown as { depthTest?: boolean }).depthTest),
          side: (material as unknown as { side?: unknown }).side ?? null,
        },
        uniforms: uniformsMap,
      };

      try { win.__copilot_starUniforms.push(snapshot); } catch { /* ignore */ }
    } catch {
      // swallow
    }
  };

  // Dump initial state synchronously so automation can pick it up early
  if (_enableShaderDevLogging) dumpMaterialState();

  // DEV: when debugging, force the material to render on-top so automated
  // sampling can determine whether the disk is being occluded by scene
  // geometry (depth) vs failing to produce visible output. This is limited
  // to development or when `copilot_debug=1` is present in the URL.
  if (_enableShaderDevLogging) {
    try {
      // Disable depth test/write so the material draws regardless of scene depth
      (material as unknown as { depthTest?: boolean }).depthTest = false;
      material.depthWrite = false;
      // Signal that the material has been forced on-top for automation
      try { (window as unknown as { __copilot_star_forceOnTop?: boolean }).__copilot_star_forceOnTop = true; } catch { /* ignore */ }
    } catch {
      // swallow dev-only errors
    }
  }

  // If automation requests a forced opaque fallback, replace fragment
  // shader with a minimal opaque output so we can validate geometry
  // and render pipeline independently of the production shader.
  try {
    const win = (typeof window !== 'undefined') ? (window as Window & { __copilot_forceStarOpaque?: boolean; __copilot_star_forcedOpaque?: boolean }) : undefined;
    if (win && win.__copilot_forceStarOpaque) {
      // minimal GLSL fragment for debug builds
      material.fragmentShader = 'precision mediump float;\nvoid main() { gl_FragColor = vec4(1.0, 1.0, 1.0, 1.0); }';
      try { win.__copilot_star_forcedOpaque = true; } catch { /* ignore */ }
    }
  } catch { /* swallow dev-only override errors */ }

  return material;
}

export function updateMainSequenceStarUniforms(
  material: ShaderMaterial,
  update: MainSequenceStarUniformUpdate,
): void {
  const uniforms = material.uniforms as unknown as MainSequenceUniformMap;
  uniforms.iTime.value = update.time;
  const resolution = uniforms.iResolution.value;
  const width = Number.isFinite(update.resolution.width) ? Math.max(update.resolution.width, 1) : 1;
  const height = Number.isFinite(update.resolution.height) ? Math.max(update.resolution.height, 1) : 1;
  resolution.set(width, height, 1);

  if (update.organic !== undefined) {
    uniforms.iChannel0.value = resolveTexture(update.organic, FALLBACK_ORGANIC);
  }
  if (update.noise !== undefined) {
    uniforms.iChannel1.value = resolveTexture(update.noise, FALLBACK_NOISE);
  }
  if (update.cameraRoll !== undefined) {
    const v = Number.isFinite(update.cameraRoll as number) ? (update.cameraRoll as number) : 0;
    uniforms.iCameraRoll.value = v;
  }
  if (update.starNorth !== undefined) {
    const v = Number.isFinite(update.starNorth as number) ? (update.starNorth as number) : 0;
    uniforms.iStarNorth.value = v;
  }
  if (update.viewAlignment !== undefined) {
    const safeX = Number.isFinite(update.viewAlignment.x) ? update.viewAlignment.x : 0;
    const safeY = Number.isFinite(update.viewAlignment.y) ? update.viewAlignment.y : 0;
    const safeZRaw = Number.isFinite(update.viewAlignment.z) ? update.viewAlignment.z : 1;
    const safeZ = Math.min(Math.max(safeZRaw, 0), 1);
    uniforms.iViewAlignment.value.set(safeX, safeY, safeZ);
  }
  const facingCosine = uniforms.iViewAlignment.value.z;
  const hazeParams = deriveHazeUniform(facingCosine, update.haze);
  uniforms.iHazeParams.value.set(hazeParams.fade, hazeParams.edgeThreshold, hazeParams.edgeExponent);
  const boundaryParams = deriveBoundaryUniform(update.boundary);
  uniforms.iBoundaryFeather.value.set(boundaryParams.start, boundaryParams.exponent, boundaryParams.alphaFloor, boundaryParams.reserved);
}

export function disposeMainSequenceStarMaterial(material: ShaderMaterial | null): void {
  material?.dispose();
}
