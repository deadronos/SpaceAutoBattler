export interface GlProgramMetadata {
  linkStatus: boolean;
  activeUniforms: number;
  activeAttributes: number;
  uniforms: Array<{ name: string; size: number; type: number } | null>;
  attributes: Array<{ name: string; size: number; type: number } | null>;
}

const MAX_ENTRIES = 200;

/**
 * Captures deterministic program metadata (link status, active uniform/attribute
 * counts and their names/sizes/types) for a linked WebGL program. Shared by the
 * dev WebGL debug hooks so the extraction lives in one place.
 *
 * @param {WebGLRenderingContext | WebGL2RenderingContext} gl - The GL context.
 * @param {WebGLProgram} program - The linked program.
 * @returns {GlProgramMetadata}
 */
export function captureProgramMetadata(
  gl: WebGLRenderingContext | WebGL2RenderingContext,
  program: WebGLProgram,
): GlProgramMetadata {
  const linkStatus = Boolean(gl.getProgramParameter(program, gl.LINK_STATUS));
  const activeUniforms = Number(gl.getProgramParameter(program, gl.ACTIVE_UNIFORMS));
  const activeAttributes = Number(gl.getProgramParameter(program, gl.ACTIVE_ATTRIBUTES));

  const uniforms: GlProgramMetadata['uniforms'] = [];
  for (let i = 0; i < Math.min(activeUniforms, MAX_ENTRIES); i++) {
    try {
      const u = gl.getActiveUniform(program, i);
      uniforms.push(u ? { name: u.name, size: u.size, type: u.type } : null);
    } catch {
      uniforms.push(null);
    }
  }

  const attributes: GlProgramMetadata['attributes'] = [];
  for (let i = 0; i < Math.min(activeAttributes, MAX_ENTRIES); i++) {
    try {
      const a = gl.getActiveAttrib(program, i);
      attributes.push(a ? { name: a.name, size: a.size, type: a.type } : null);
    } catch {
      attributes.push(null);
    }
  }

  return { linkStatus, activeUniforms, activeAttributes, uniforms, attributes };
}
