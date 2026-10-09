import type { WebGLRenderer } from 'three';
import { isCopilotDebugEnabled } from '../utils/copilotDebug.js';
import { captureProgramMetadata } from './webglDebugHooks.js';

// Install lightweight dev-only WebGL hooks that capture shader compile/link logs
// and GL errors into a window-global array for later automated inspection.
// Gate this behind the debug query param or non-production builds.
export function installWebGLDebugHooks(renderer: WebGLRenderer): void {
  if (typeof window === 'undefined') return;
  const win = window as Window & { __copilot_glLogs?: Array<unknown> & { __installed?: boolean } };

  // Enable if NODE_ENV !== 'production' OR ?copilot_debug=1 in URL
  const debugEnabled = !import.meta.env.PROD || isCopilotDebugEnabled();
  if (!debugEnabled) return;

  // Avoid double-install
  if (win.__copilot_glLogs && win.__copilot_glLogs.__installed) return;

  // Try to obtain the raw WebGL context
  const ctx =
    (renderer.getContext &&
      (renderer.getContext() as WebGLRenderingContext | WebGL2RenderingContext)) ||
    (renderer.domElement &&
      ((renderer.domElement.getContext('webgl2') as WebGL2RenderingContext) ||
        (renderer.domElement.getContext('webgl') as WebGLRenderingContext)));
  if (!ctx) return;

  win.__copilot_glLogs = win.__copilot_glLogs || [];
  const logs = win.__copilot_glLogs as Array<unknown> & { __installed?: boolean };
  logs.__installed = true;

  const push = (type: string, details: unknown) => {
    try {
      win.__copilot_glLogs!.push({ time: Date.now(), type, details });
    } catch {
      // swallow
    }
  };

  // Wrap compileShader to capture shader info logs
  const origCompileShader = ctx.compileShader.bind(ctx);
  ctx.compileShader = (shader: WebGLShader) => {
    origCompileShader(shader);
    try {
      const info = ctx.getShaderInfoLog(shader);
      if (info) push('compileShaderInfo', info);
    } catch {
      push('compileShaderException', 'exception');
    }
  };

  // Wrap linkProgram to capture program info logs
  const origLinkProgram = ctx.linkProgram.bind(ctx);
  ctx.linkProgram = (program: WebGLProgram) => {
    origLinkProgram(program);
    try {
      const info = ctx.getProgramInfoLog(program);
      if (info) push('linkProgramInfo', info);
    } catch {
      push('linkProgramException', 'exception');
    }

    // Record deterministic program metadata even when infoLog is empty
    try {
      push('programMetadata', captureProgramMetadata(ctx, program));
    } catch (e) {
      push('programMetadataException', String(e));
    }
  };

  // Wrap getError to capture any GL errors observed when called
  const origGetError = ctx.getError.bind(ctx);
  ctx.getError = () => {
    const err = origGetError();
    if (err && err !== 0) push('glError', err);
    return err;
  };

  // Record that hooks were installed
  push('installed', {});

  // Helpful console trace for devs
  console.info('[copilot][glDebug] installed WebGL hooks (window.__copilot_glLogs)');
}
