import { isCopilotDebugEnabled } from '../utils/copilotDebug.js';

// Patch WebGL prototype methods early to capture shader compile/link logs.
// This file should be imported at application entry before any WebGL context is created.
if (typeof window !== 'undefined') {
  type GlLog = { time: number; type: string; details: string | number | object | null };
  const win = window as Window & { __copilot_glLogs?: Array<GlLog> & { __installed?: boolean } };
  const debugEnabled = !import.meta.env.PROD || isCopilotDebugEnabled();
  if (debugEnabled) {
    try {
      win.__copilot_glLogs = win.__copilot_glLogs || [];
      const logs = win.__copilot_glLogs as Array<GlLog> & { __installed?: boolean };
      if (!logs.__installed) {
        logs.__installed = true;

        // Save originals
        const proto =
          typeof WebGL2RenderingContext !== 'undefined'
            ? WebGL2RenderingContext.prototype
            : WebGLRenderingContext.prototype;
        const origCompileShader = proto.compileShader;
        const origLinkProgram = proto.linkProgram;
        const origGetError = proto.getError;

        proto.compileShader = function (shader: WebGLShader) {
          const result = (origCompileShader as Function).apply(this, arguments as IArguments);
          try {
            const info = (this as WebGLRenderingContext).getShaderInfoLog(shader);
            if (info && info.length) {
              logs.push({ time: Date.now(), type: 'compileShaderInfo', details: String(info) });
            }
          } catch {
            logs.push({ time: Date.now(), type: 'compileShaderException', details: 'exception' });
          }
          return result;
        };

        proto.linkProgram = function (program: WebGLProgram) {
          const result = (origLinkProgram as Function).apply(this, arguments as IArguments);
          try {
            const info = (this as WebGLRenderingContext).getProgramInfoLog(program);
            if (info && info.length) {
              logs.push({ time: Date.now(), type: 'linkProgramInfo', details: String(info) });
            }
          } catch {
            logs.push({ time: Date.now(), type: 'linkProgramException', details: 'exception' });
          }

          // Always record program metadata (LINK_STATUS, number of active uniforms/attributes)
          try {
            const gl = this as WebGLRenderingContext;
            const linkStatus = Boolean(gl.getProgramParameter(program, gl.LINK_STATUS));
            const activeUniforms = Number(gl.getProgramParameter(program, gl.ACTIVE_UNIFORMS));
            const activeAttributes = Number(gl.getProgramParameter(program, gl.ACTIVE_ATTRIBUTES));
            const uniforms: Array<{ name: string; size: number; type: number } | null> = [];
            for (let i = 0; i < Math.min(activeUniforms, 200); i++) {
              try {
                const u = gl.getActiveUniform(program, i);
                uniforms.push(u ? { name: u.name, size: u.size, type: u.type } : null);
              } catch {
                uniforms.push(null);
              }
            }
            const attributes: Array<{ name: string; size: number; type: number } | null> = [];
            for (let i = 0; i < Math.min(activeAttributes, 200); i++) {
              try {
                const a = gl.getActiveAttrib(program, i);
                attributes.push(a ? { name: a.name, size: a.size, type: a.type } : null);
              } catch {
                attributes.push(null);
              }
            }
            logs.push({
              time: Date.now(),
              type: 'programMetadata',
              details: { linkStatus, activeUniforms, activeAttributes, uniforms, attributes },
            });
          } catch {
            logs.push({ time: Date.now(), type: 'programMetadataException', details: 'exception' });
          }

          return result;
        };

        proto.getError = function () {
          const err = (origGetError as Function).apply(this, arguments as IArguments) as number;
          try {
            if (err && err !== 0) logs.push({ time: Date.now(), type: 'glError', details: err });
          } catch {
            // ignore
          }
          return err;
        };

        logs.push({ time: Date.now(), type: 'installedPrototypePatch', details: {} });
        console.info(
          '[copilot][glDebug] installed WebGL prototype patch (window.__copilot_glLogs)',
        );
      }
    } catch (err) {
      console.warn('[copilot][glDebug] prototype patch failed', String(err));
    }
  }
}
