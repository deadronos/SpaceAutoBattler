/**
 * PlanetRings uniform synchronisation.
 *
 * Owns the two `useEffect`s that keep the ring material's shader uniforms in
 * sync with the postprocessing toggle and the component props. The effects are
 * moved verbatim from `PlanetRings`; their dependency arrays and bodies are
 * unchanged.
 */

import { useEffect } from 'react';
import { AdditiveBlending, NormalBlending } from 'three';
import type { MeshBasicMaterial, ShaderMaterial } from 'three';
import { colorFromConfig } from '../utils/color.js';
import { reportMaterialError } from '../utils/errorReporting.js';
import type { PlanetRingsUniforms } from '../types/renderer.js';

/** Type guard to check if material has uniforms (ShaderMaterial). */
export function isShaderMat(
  mat: ShaderMaterial | MeshBasicMaterial,
): mat is ShaderMaterial & { uniforms: PlanetRingsUniforms } {
  return 'uniforms' in mat;
}

export interface PlanetRingUniformsParams {
  materialToUse: ShaderMaterial | MeshBasicMaterial;
  postprocessingEnabled: boolean;
  opacity: number;
  brightness: number;
  innerRadius: number;
  outerRadius: number;
  fresnelStrength: number;
  tintColor?: string;
  tintMix?: number;
  bandFrequency: number;
  bandStrength: number;
  bandNoiseScale: number;
  bandDarkness: number;
  planetCenter: { x: number; y: number; z: number };
  planetRadius: number;
  shadowStrength: number;
  penumbra: number;
  lightDir: { x: number; y: number; z: number };
}

/**
 * Keep the PlanetRings shader material's uniforms and blending in sync.
 *
 * Must be called unconditionally so hook order stays stable.
 */
export function usePlanetRingUniforms({
  materialToUse,
  postprocessingEnabled,
  opacity,
  brightness,
  innerRadius,
  outerRadius,
  fresnelStrength,
  tintColor,
  tintMix,
  bandFrequency,
  bandStrength,
  bandNoiseScale,
  bandDarkness,
  planetCenter,
  planetRadius,
  shadowStrength,
  penumbra,
  lightDir,
}: PlanetRingUniformsParams): void {
  // Update uniforms and blending when postprocessing toggles or props change.
  useEffect(() => {
    try {
      if (isShaderMat(materialToUse)) {
        const uniforms = materialToUse.uniforms;
        const desiredTintMix =
          typeof tintMix === 'number' ? tintMix : postprocessingEnabled ? 0.0 : 0.9;
        uniforms.uTintMix.value = desiredTintMix;
        uniforms.uTintColor.value = colorFromConfig(tintColor ?? '#d9efff');
        uniforms.uBrightness.value = postprocessingEnabled ? brightness : Math.max(brightness, 1.6);
        uniforms.uOpacity.value = postprocessingEnabled ? opacity : Math.max(0.45, opacity);
        uniforms.uBandFreq.value = bandFrequency;
        uniforms.uBandStrength.value = bandStrength;
        uniforms.uBandNoiseScale.value = bandNoiseScale;
        uniforms.uBandDarkness.value = bandDarkness;
        uniforms.uPlanetCenter.value = [planetCenter.x, planetCenter.y, planetCenter.z];
        uniforms.uPlanetRadius.value = planetRadius;
        uniforms.uShadowStrength.value = shadowStrength;
        uniforms.uPenumbra.value = penumbra;
        uniforms.uLightDir.value = [lightDir.x, lightDir.y, lightDir.z];
        try {
          materialToUse.blending = postprocessingEnabled ? AdditiveBlending : NormalBlending;
        } catch (error) {
          // Expected: Blending mode may be read-only
          reportMaterialError('blending', 'ringMaterial', error);
        }
        try {
          materialToUse.needsUpdate = true;
        } catch (error) {
          // Expected: Material may be disposed during React unmount cycle
          reportMaterialError('needsUpdate', 'ringMaterial', error);
        }
      }
    } catch (error) {
      // Expected: Material may be disposed during React unmount cycle
      reportMaterialError('uniformUpdate.postprocessing', 'ringMaterial', error);
    }
  }, [
    materialToUse,
    postprocessingEnabled,
    opacity,
    brightness,
    bandFrequency,
    bandStrength,
    bandNoiseScale,
    bandDarkness,
    planetCenter,
    planetRadius,
    shadowStrength,
    penumbra,
    lightDir,
    tintColor,
    tintMix,
  ]);

  // Keep uniforms in sync when props change
  useEffect(() => {
    try {
      if (isShaderMat(materialToUse)) {
        const uniforms = materialToUse.uniforms;
        uniforms.uOpacity.value = opacity;
        uniforms.uInnerRadius.value = innerRadius;
        uniforms.uOuterRadius.value = outerRadius;
        uniforms.uBrightness.value = brightness;
        uniforms.uFresnelStrength.value = fresnelStrength;
        uniforms.uBandFreq.value = bandFrequency;
        uniforms.uPlanetCenter.value = [planetCenter.x, planetCenter.y, planetCenter.z];
        uniforms.uPlanetRadius.value = planetRadius;
        uniforms.uPenumbra.value = penumbra;
        try {
          materialToUse.needsUpdate = true;
        } catch (error) {
          // Expected: Material may be disposed during React unmount cycle
          reportMaterialError('needsUpdate', 'ringMaterial', error);
        }
      }
    } catch (error) {
      // Expected: Material may be disposed during React unmount cycle
      reportMaterialError('uniformUpdate.props', 'ringMaterial', error);
    }
  }, [
    materialToUse,
    opacity,
    innerRadius,
    outerRadius,
    brightness,
    fresnelStrength,
    bandFrequency,
    planetCenter,
    planetRadius,
    penumbra,
  ]);
}
