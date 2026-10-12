import { MeshBasicMaterial, NoBlending, ShaderMaterial } from 'three';
import fragmentShaderRaw from './shaders/mainsequencestar.glsl';
import { withCommonGlsl } from './shaders/index.js';
import vertexShader from './shaders/starSphere.vertex.glsl';
import { reportMaterialError } from '../utils/errorReporting.js';
import { RENDERER_VISUAL_CONFIG } from '../config/renderer.js';

/**
 * Builds the depth-pass material for the star sphere.
 *
 * When a shader material is available it shares that material's uniforms and
 * adds a `DEPTH_PASS` define (colorWrite off, depthWrite on, no blending), with
 * a slight polygon offset to reduce z-fighting against the visual mesh. If the
 * shader material cannot be created, falls back to a basic depth-only material.
 *
 * @param {ShaderMaterial | null} appliedMaterial - The visual star material, if any.
 * @returns {ShaderMaterial | MeshBasicMaterial} The depth-pass material.
 */
export function createStarSphereDepthMaterial(
  appliedMaterial: ShaderMaterial | null,
): ShaderMaterial | MeshBasicMaterial {
  if (appliedMaterial instanceof ShaderMaterial) {
    try {
      // Mirror the visual pass's low-quality define so both passes compile the
      // same octave count. Prefer the visual material's own defines (the single
      // source of truth); fall back to the config for materials built without it.
      const defines: Record<string, string> = { DEPTH_PASS: '1' };
      const visualDefines = appliedMaterial.defines as Record<string, string> | undefined;
      if (visualDefines?.LOW_QUALITY !== undefined) {
        defines.LOW_QUALITY = visualDefines.LOW_QUALITY;
      } else if (RENDERER_VISUAL_CONFIG.performanceTier === 'low') {
        defines.LOW_QUALITY = '1';
      }

      const depthMat = new ShaderMaterial({
        vertexShader,
        fragmentShader: withCommonGlsl(fragmentShaderRaw),
        uniforms: appliedMaterial.uniforms,
        defines,
        depthWrite: true,
        depthTest: true,
        colorWrite: false,
        blending: NoBlending,
        transparent: false,
        premultipliedAlpha: appliedMaterial.premultipliedAlpha || false,
      });
      // Slight polygon offset to reduce z-fighting with the visual mesh
      depthMat.polygonOffset = true;
      depthMat.polygonOffsetFactor = -1;
      depthMat.polygonOffsetUnits = 1;
      return depthMat;
    } catch (error) {
      reportMaterialError('shaderCreation', 'depthShaderMaterial', error);
    }
  }

  return new MeshBasicMaterial({
    color: '#000',
    depthWrite: true,
    depthTest: true,
    colorWrite: false,
  });
}
