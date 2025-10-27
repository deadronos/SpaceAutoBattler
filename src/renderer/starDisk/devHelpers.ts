import { Texture } from 'three';
import type { ShaderMaterial, WebGLRenderer } from 'three';

type MaterialWithDepth = ShaderMaterial & { depthTest?: boolean };

type ShaderCompileArgs = Parameters<ShaderMaterial['onBeforeCompile']>;

declare global {
  interface Window {
    __copilot_forceStarOpaque?: boolean;
    __copilot_star_forcedOpaque?: boolean;
    __STAR_COMPILED?: boolean;
    __copilot_starUniforms?: Array<unknown>;
    __copilot_glLogs?: Array<unknown>;
    __copilot_star_forceOnTop?: boolean;
    __copilot_forceStarOpaqueReset?: () => void;
    __copilot_star_compile_dispose?: Array<() => void>;
  }
}

export const shouldEnableStarDiskDevHelpers = (): boolean => {
  if (typeof window !== 'undefined') {
    try {
      if (/[?&]copilot_debug=1/.test(window.location.search)) {
        return true;
      }
    } catch {
      // Ignore URL parsing failures
    }
  }
  return process.env.NODE_ENV !== 'production';
};

export function installDevHelpers(material: ShaderMaterial, renderer?: WebGLRenderer): () => void {
  const materialWithDepth = material as MaterialWithDepth;
  const previousOnBeforeCompile = material.onBeforeCompile;
  const previousDepthTest = materialWithDepth.depthTest;
  const previousDepthWrite = material.depthWrite;
  let disposed = false;
  let logged = false;

  const dumpMaterialState = () => {
    try {
      const win =
        typeof window !== 'undefined'
          ? (window as Window & { __copilot_starUniforms?: Array<unknown> })
          : undefined;
      if (!win) return;
      win.__copilot_starUniforms = win.__copilot_starUniforms || [];

      const uniformsMap: Record<string, unknown> = {};
      try {
        const uniforms = material.uniforms as unknown as Record<string, { value: unknown }>;
        for (const key of Object.keys(uniforms)) {
          const uniformValue = uniforms[key]?.value as unknown;
          if (uniformValue == null) {
            uniformsMap[key] = null;
          } else if (
            typeof uniformValue === 'number' ||
            typeof uniformValue === 'string' ||
            typeof uniformValue === 'boolean'
          ) {
            uniformsMap[key] = uniformValue;
          } else {
            const maybeArrayProvider = uniformValue as unknown as { toArray?: () => unknown };
            if (maybeArrayProvider && typeof maybeArrayProvider.toArray === 'function') {
              try {
                uniformsMap[key] = maybeArrayProvider.toArray.call(uniformValue);
              } catch {
                uniformsMap[key] = String(uniformValue);
              }
            } else if ((uniformValue as Texture) instanceof Texture) {
              const tex = uniformValue as Texture;
              const image =
                (tex as unknown as { image?: { width?: number; height?: number } }).image || null;
              uniformsMap[key] = {
                name: tex.name,
                uuid: tex.uuid,
                wrapS: tex.wrapS,
                wrapT: tex.wrapT,
                wrapR: (tex as { wrapR?: unknown }).wrapR,
                minFilter: tex.minFilter,
                magFilter: tex.magFilter,
                anisotropy: tex.anisotropy,
                format: tex.format,
                type: tex.type,
                colorSpace: tex.colorSpace,
                image,
              };
            } else {
              uniformsMap[key] = String(uniformValue);
            }
          }
        }
      } catch {
        /* ignore */
      }

      const snapshot = {
        time: Date.now(),
        name: material.name,
        uuid: material.uuid,
        uniforms: uniformsMap,
      };

      try {
        win.__copilot_starUniforms.push(snapshot);
      } catch {
        /* ignore */
      }
    } catch {
      // swallow
    }
  };

  const compileHandler = (args: ShaderCompileArgs) => {
    if (disposed) return;

    const [shader, compileRenderer] = args;
    const activeRenderer = renderer ?? compileRenderer;

    const win =
      typeof window !== 'undefined'
        ? (window as Window & { __copilot_forceStarOpaque?: boolean })
        : undefined;
    if (logged && !(win && win.__copilot_forceStarOpaque)) {
      if (typeof previousOnBeforeCompile === 'function') {
        previousOnBeforeCompile.call(material, shader, compileRenderer);
      }
      return;
    }
    logged = true;

    try {
      console.groupCollapsed('[STARDEV] MainSequenceStar shader compile info');
      console.log('[STARDEV] vertex shader (trunc):', (shader.vertexShader || '').slice(0, 1024));
      console.log(
        '[STARDEV] fragment shader (trunc):',
        (shader.fragmentShader || '').slice(0, 1024),
      );

      try {
        (window as unknown as { __STAR_COMPILED?: boolean }).__STAR_COMPILED = true;
        try {
          if (typeof localStorage !== 'undefined' && localStorage) {
            localStorage.setItem('copilot_star_compiled', String(Date.now()));
          }
        } catch {
          void 0;
        }
        if (typeof document !== 'undefined') {
          try {
            document.documentElement.setAttribute('data-star-compiled', '1');
          } catch {
            void 0;
          }
          const id = 'copilot-star-compiled-indicator';
          if (!document.getElementById(id)) {
            const el = document.createElement('div');
            el.id = id;
            el.textContent = 'STAR COMPILE STARTED';
            el.style.cssText =
              'position:fixed; right:12px; bottom:12px; padding:6px 10px; background:rgba(59,130,246,0.95); color:white; font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif; font-size:12px; border-radius:6px; box-shadow:0 2px 6px rgba(0,0,0,0.35); z-index:9999999;';
            document.body.appendChild(el);
            setTimeout(() => {
              try {
                el.remove();
              } catch {
                /* ignore */
              }
            }, 4000);
          }
        }
      } catch (flagErr) {
        console.warn('[STARDEV] failed to create DOM compile-start indicator', flagErr);
      }
    } catch (logErr) {
      console.warn('[STARDEV] failed to print shader source', logErr);
    }

    try {
      const props = (
        activeRenderer as unknown as { properties?: { get: (key: ShaderMaterial) => unknown } }
      )?.properties;
      const start = Date.now();
      const maxWaitMs = 10000;
      const pollInterval = 200;

      try {
        (window as unknown as { __STAR_COMPILE_ATTEMPTED?: string }).__STAR_COMPILE_ATTEMPTED =
          String(Date.now());
      } catch {
        void 0;
      }
      try {
        if (typeof localStorage !== 'undefined') {
          localStorage.setItem('copilot_star_compiled', String(Date.now()));
        }
      } catch {
        void 0;
      }

      const handle = setInterval(() => {
        try {
          const matProp = props?.get(material) as unknown;
          const programField = (matProp as { program?: unknown } | undefined)?.program;

          let webglProgram: WebGLProgram | null = null;
          if (programField && typeof programField === 'object') {
            webglProgram =
              (programField as { program?: WebGLProgram }).program ??
              (programField as unknown as WebGLProgram);
          } else if (programField && typeof programField !== 'object') {
            webglProgram = programField as unknown as WebGLProgram;
          }

          if (webglProgram) {
            try {
              try {
                dumpMaterialState();
              } catch {
                /* ignore */
              }

              const gl = activeRenderer.getContext();
              const programInfo = gl.getProgramInfoLog(webglProgram);
              if (programInfo && programInfo.length) {
                console.log('[STARDEV] GL Program InfoLog:', programInfo);
              }
              const err = gl.getError();
              if (err !== 0) console.log('[STARDEV] GL getError:', err);

              try {
                const winLogs = window as unknown as { __copilot_glLogs?: Array<unknown> };
                if (winLogs && winLogs.__copilot_glLogs) {
                  const linkStatus = Boolean(
                    gl.getProgramParameter(webglProgram, (gl as WebGLRenderingContext).LINK_STATUS),
                  );
                  const activeUniforms = Number(
                    gl.getProgramParameter(
                      webglProgram,
                      (gl as WebGLRenderingContext).ACTIVE_UNIFORMS,
                    ),
                  );
                  const activeAttributes = Number(
                    gl.getProgramParameter(
                      webglProgram,
                      (gl as WebGLRenderingContext).ACTIVE_ATTRIBUTES,
                    ),
                  );
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
                    winLogs.__copilot_glLogs.push({
                      time: Date.now(),
                      type: 'programMetadataViaPoller',
                      details: {
                        linkStatus,
                        activeUniforms,
                        activeAttributes,
                        uniforms,
                        attributes,
                      },
                    });
                  } catch {
                    // Ignore push failures
                  }
                }
              } catch {
                // swallow metadata push errors — non-critical
              }

              try {
                (window as unknown as { __STAR_COMPILED?: boolean }).__STAR_COMPILED = true;
                if (typeof document !== 'undefined') {
                  const id = 'copilot-star-compiled-indicator';
                  if (!document.getElementById(id)) {
                    const el = document.createElement('div');
                    el.id = id;
                    el.textContent = 'STAR COMPILED';
                    el.style.cssText =
                      'position:fixed; right:12px; bottom:12px; padding:6px 10px; background:rgba(16,185,129,0.95); color:white; font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif; font-size:12px; border-radius:6px; box-shadow:0 2px 6px rgba(0,0,0,0.35); z-index:9999999;';
                    document.body.appendChild(el);
                    setTimeout(() => {
                      try {
                        el.remove();
                      } catch {
                        /* ignore */
                      }
                    }, 4000);
                  }
                }
              } catch (domErr) {
                console.warn('[STARDEV] failed to create DOM compile indicator', domErr);
              }
            } catch (innerErr) {
              console.warn('[STARDEV] failed to read GL program/log', innerErr);
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
          console.warn('[STARDEV] poll error while waiting for program', pollErr);
        }
      }, pollInterval);

      try {
        const winCleanup = window as unknown as {
          __copilot_star_compile_dispose?: Array<() => void>;
        };
        if (winCleanup) {
          winCleanup.__copilot_star_compile_dispose =
            winCleanup.__copilot_star_compile_dispose || [];
          winCleanup.__copilot_star_compile_dispose.push(() => clearInterval(handle));
        }
      } catch {
        /* ignore */
      }
    } catch (installErr) {
      console.warn('[STARDEV] failed to install program poller', installErr);
      console.groupEnd();
    }

    if (typeof previousOnBeforeCompile === 'function') {
      previousOnBeforeCompile.call(material, shader, compileRenderer);
    }
  };

  material.onBeforeCompile = (...args: ShaderCompileArgs) => compileHandler(args);

  dumpMaterialState();

  try {
    materialWithDepth.depthTest = false;
    material.depthWrite = false;
    try {
      (window as unknown as { __copilot_star_forceOnTop?: boolean }).__copilot_star_forceOnTop =
        true;
    } catch {
      /* ignore */
    }
  } catch {
    // swallow dev-only errors
  }

  try {
    const win =
      typeof window !== 'undefined'
        ? (window as Window & {
            __copilot_forceStarOpaque?: boolean;
            __copilot_star_forcedOpaque?: boolean;
          })
        : undefined;
    if (win && win.__copilot_forceStarOpaque) {
      material.fragmentShader =
        'precision mediump float;\nvoid main() { gl_FragColor = vec4(1.0, 1.0, 1.0, 1.0); }';
      try {
        win.__copilot_star_forcedOpaque = true;
      } catch {
        /* ignore */
      }
    }
  } catch {
    /* swallow dev-only override errors */
  }

  return () => {
    if (disposed) return;
    disposed = true;
    material.onBeforeCompile = previousOnBeforeCompile;
    materialWithDepth.depthTest = previousDepthTest;
    material.depthWrite = previousDepthWrite;
  };
}
