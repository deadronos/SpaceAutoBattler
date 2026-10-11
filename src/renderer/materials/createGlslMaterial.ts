import { ShaderMaterial } from 'three';
import type { IUniform, ShaderMaterialParameters } from 'three';
import { withCommonGlsl } from '../shaders/index.js';

/**
 * Options for {@link createGlslMaterial}.
 *
 * Extends the standard `ShaderMaterial` parameters, replacing the shader
 * sources and uniform map with explicit fields. Every other parameter (for
 * example `blending`, `transparent`, `depthWrite`, `side`, `name`,
 * `premultipliedAlpha`) is forwarded verbatim to the `ShaderMaterial`.
 */
export interface GlslMaterialOptions extends Omit<
  ShaderMaterialParameters,
  'vertexShader' | 'fragmentShader' | 'uniforms'
> {
  /** Vertex shader source, used verbatim. */
  vertexShader: string;
  /** Fragment shader source, used verbatim or with `COMMON_GLSL` prepended. */
  fragmentShader: string;
  /** Uniform map forwarded to the material as-is. */
  uniforms?: Record<string, IUniform>;
  /**
   * When not `false`, `withCommonGlsl` is applied to `fragmentShader` before
   * construction. Defaults to `true`.
   */
  prependCommonGlsl?: boolean;
}

/**
 * Creates a `ShaderMaterial`, optionally prepending the shared `COMMON_GLSL`
 * helpers to the fragment shader. All other `ShaderMaterialParameters` are
 * forwarded unchanged.
 *
 * @param {GlslMaterialOptions} options - Shader sources and material parameters.
 * @returns {ShaderMaterial} A configured shader material.
 */
export function createGlslMaterial(options: GlslMaterialOptions): ShaderMaterial {
  const { vertexShader, fragmentShader, uniforms, prependCommonGlsl, ...parameters } = options;

  const materialParameters: ShaderMaterialParameters = {
    ...parameters,
    vertexShader,
    fragmentShader: prependCommonGlsl === false ? fragmentShader : withCommonGlsl(fragmentShader),
  };

  if (uniforms !== undefined) {
    materialParameters.uniforms = uniforms;
  }

  return new ShaderMaterial(materialParameters);
}
