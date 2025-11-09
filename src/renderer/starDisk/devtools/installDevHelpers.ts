import type { ShaderMaterial, WebGLRenderer } from 'three';
import { recordMaterialSnapshot } from './materialSnapshot.js';
import {
  getForceOnTopFlag,
  isForceOpaqueEnabled,
  markCompileAttempt,
  markCompileComplete,
  markForceOpaqueApplied,
  setForceOnTopFlag,
  pushGlLogEntry,
} from './debugWindow.js';
import { showCompileStartIndicator, showCompileSuccessIndicator } from './domIndicators.js';
import { installProgramPoller } from './programPoller.js';

type MaterialWithDepth = ShaderMaterial & { depthTest?: boolean };

type ShaderCompileArgs = Parameters<ShaderMaterial['onBeforeCompile']>;

const forceOpaqueShader =
  'precision mediump float;\nvoid main() { gl_FragColor = vec4(1.0, 1.0, 1.0, 1.0); }';

const runPreviousCompile = (
  material: ShaderMaterial,
  previous: ShaderMaterial['onBeforeCompile'],
  shader: ShaderCompileArgs[0],
  renderer: ShaderCompileArgs[1],
): void => {
  if (typeof previous === 'function') {
    previous.call(material, shader, renderer);
  }
};

const logShaderSource = (label: string, source: string | undefined): void => {
  try {
    console.log(label, (source ?? '').slice(0, 1024));
  } catch {
    // ignore logging failures
  }
};

const collectProgramMetadata = (
  gl: WebGLRenderingContext,
  program: WebGLProgram,
): {
  uniforms: Array<{ name: string; size: number; type: number } | null>;
  attributes: Array<{ name: string; size: number; type: number } | null>;
  activeUniforms: number;
  activeAttributes: number;
  linkStatus: boolean;
} => {
  const asLegacyContext = gl as WebGLRenderingContext;
  const activeUniforms = Number(gl.getProgramParameter(program, asLegacyContext.ACTIVE_UNIFORMS));
  const activeAttributes = Number(
    gl.getProgramParameter(program, asLegacyContext.ACTIVE_ATTRIBUTES),
  );
  const uniforms: Array<{ name: string; size: number; type: number } | null> = [];
  const attributes: Array<{ name: string; size: number; type: number } | null> = [];
  for (let i = 0; i < Math.min(activeUniforms, 200); i += 1) {
    try {
      const uniform = gl.getActiveUniform(program, i);
      uniforms.push(
        uniform ? { name: uniform.name, size: uniform.size, type: uniform.type } : null,
      );
    } catch {
      uniforms.push(null);
    }
  }
  for (let i = 0; i < Math.min(activeAttributes, 200); i += 1) {
    try {
      const attribute = gl.getActiveAttrib(program, i);
      attributes.push(
        attribute ? { name: attribute.name, size: attribute.size, type: attribute.type } : null,
      );
    } catch {
      attributes.push(null);
    }
  }
  const linkStatus = Boolean(gl.getProgramParameter(program, asLegacyContext.LINK_STATUS));
  return { uniforms, attributes, activeUniforms, activeAttributes, linkStatus };
};

export function installDevHelpers(material: ShaderMaterial, renderer?: WebGLRenderer): () => void {
  const materialWithDepth = material as MaterialWithDepth;
  const previousOnBeforeCompile = material.onBeforeCompile;
  const previousDepthTest = materialWithDepth.depthTest;
  const previousDepthWrite = material.depthWrite;
  const previousForceOnTop = getForceOnTopFlag();
  const previousFragmentShader = material.fragmentShader;
  let disposed = false;
  let logged = false;

  const compileHandler = ([shader, compileRenderer]: ShaderCompileArgs): void => {
    if (disposed) return;
    const activeRenderer = renderer ?? compileRenderer;
    if (!activeRenderer) {
      runPreviousCompile(material, previousOnBeforeCompile, shader, compileRenderer);
      return;
    }

    if (logged && !isForceOpaqueEnabled()) {
      runPreviousCompile(material, previousOnBeforeCompile, shader, compileRenderer);
      return;
    }
    logged = true;

    console.groupCollapsed('[STARDEV] MainSequenceStar shader compile info');
    logShaderSource('[STARDEV] vertex shader (trunc):', shader.vertexShader);
    logShaderSource('[STARDEV] fragment shader (trunc):', shader.fragmentShader);

    markCompileAttempt();
    showCompileStartIndicator();

    try {
      recordMaterialSnapshot(material);
    } catch {
      // ignore snapshot failures
    }

    installProgramPoller({
      material,
      renderer: activeRenderer,
      onProgramReady: (gl, program) => {
        try {
          recordMaterialSnapshot(material);
        } catch {
          // ignore snapshot failures
        }

        try {
          const programInfo = gl.getProgramInfoLog(program);
          if (programInfo && programInfo.length) {
            console.log('[STARDEV] GL Program InfoLog:', programInfo);
          }
          const err = gl.getError();
          if (err !== 0) {
            console.log('[STARDEV] GL getError:', err);
          }
        } catch (metadataErr) {
          console.warn('[STARDEV] failed to read GL program/log', metadataErr);
        }

        try {
          const details = collectProgramMetadata(gl, program);
          pushGlLogEntry({
            time: Date.now(),
            type: 'programMetadataViaPoller',
            details,
          });
        } catch {
          // ignore metadata push errors
        }

        markCompileComplete();
        showCompileSuccessIndicator();
        console.groupEnd();
      },
      onTimeout: () => {
        console.warn('[STARDEV] timed out waiting for compiled WebGL program (dev-only)');
        console.groupEnd();
      },
      onError: (error) => {
        console.warn('[STARDEV] poll error while waiting for program', error);
        console.groupEnd();
      },
    });

    runPreviousCompile(material, previousOnBeforeCompile, shader, compileRenderer);
  };

  material.onBeforeCompile = (...args: ShaderCompileArgs) => compileHandler(args);

  try {
    recordMaterialSnapshot(material);
  } catch {
    // ignore initial snapshot failure
  }

  try {
    materialWithDepth.depthTest = false;
    material.depthWrite = false;
  } catch {
    // ignore depth override failures
  }

  setForceOnTopFlag(true);

  if (isForceOpaqueEnabled()) {
    material.fragmentShader = forceOpaqueShader;
    markForceOpaqueApplied();
  }

  return () => {
    if (disposed) return;
    disposed = true;
    material.onBeforeCompile = previousOnBeforeCompile;
    materialWithDepth.depthTest = previousDepthTest;
    material.depthWrite = previousDepthWrite;
    setForceOnTopFlag(previousForceOnTop);
    if (isForceOpaqueEnabled()) {
      material.fragmentShader = previousFragmentShader;
    }
  };
}
