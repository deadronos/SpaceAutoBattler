import {
  AdditiveBlending,
  DoubleSide,
  MeshBasicMaterial,
  NormalBlending,
  ShaderMaterial,
} from 'three';
import { colorFromConfig } from '../../utils/color.js';
import { reportMaterialError } from '../../utils/errorReporting.js';
import type { MaterialWithUserData } from '../../types/renderer.js';
import planetRingVertexShader from '../shaders/planetRing.vertex.glsl';
import planetRingFragmentShader from '../shaders/planetRing.fragment.glsl';
import { createGlslMaterial } from '../materials/createGlslMaterial.js';

export interface PlanetRingMaterialOptions {
  color: string;
  opacity: number;
  innerRadius: number;
  outerRadius: number;
  brightness: number;
  fresnelStrength: number;
  tintColor?: string;
  tintMix?: number;
  bloomOnly: boolean;
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
 * Builds the shader material for planet rings.
 *
 * @param {PlanetRingMaterialOptions} opts - Ring appearance/lighting options.
 * @returns {ShaderMaterial}
 */
export function createPlanetRingMaterial(opts: PlanetRingMaterialOptions): ShaderMaterial {
  const {
    color,
    opacity,
    innerRadius,
    outerRadius,
    brightness,
    fresnelStrength,
    tintColor,
    tintMix,
    bloomOnly,
    bandFrequency,
    bandStrength,
    bandNoiseScale,
    bandDarkness,
    planetCenter,
    planetRadius,
    shadowStrength,
    penumbra,
    lightDir,
  } = opts;

  const mat = createGlslMaterial({
    uniforms: {
      uColor: { value: colorFromConfig(color) },
      uOpacity: { value: opacity },
      uInnerRadius: { value: innerRadius },
      uOuterRadius: { value: outerRadius },
      // Fresnel-like highlight strength (view-dependent)
      uFresnelStrength: { value: fresnelStrength },
      // Brightness multiplier for base color
      uBrightness: { value: brightness },
      // Optional tint to ensure visibility when postprocessing is off
      uTintColor: { value: colorFromConfig(tintColor ?? '#d9efff') },
      uTintMix: { value: typeof tintMix === 'number' ? tintMix : 0.0 },
      // Banding
      uBandFreq: { value: bandFrequency },
      uBandStrength: { value: bandStrength },
      uBandNoiseScale: { value: bandNoiseScale },
      uBandDarkness: { value: bandDarkness },
      // Planet shadowing (in world-space)
      uPlanetCenter: { value: [planetCenter.x, planetCenter.y, planetCenter.z] },
      uPlanetRadius: { value: planetRadius },
      uShadowStrength: { value: shadowStrength },
      // Penumbra (normalized fraction of planet radius)
      uPenumbra: { value: penumbra },
      // Light direction (world space) — default matches CELESTIAL_ENVIRONMENT but may be overridden by caller
      uLightDir: { value: [lightDir.x, lightDir.y, lightDir.z] },
    },
    vertexShader: planetRingVertexShader,
    fragmentShader: planetRingFragmentShader,
    prependCommonGlsl: false,
    transparent: true,
    depthWrite: false,
    depthTest: true,
    side: DoubleSide,
    blending: AdditiveBlending,
  });

  try {
    // Ensure this material writes to the main color buffer by default when
    // bloomOnly is not requested. If bloomOnly is true the material will
    // intentionally allow the BloomProvider to toggle colorWrite in order
    // to render the object primarily via bloom.
    mat.colorWrite = true;
    if (!mat.userData) mat.userData = {};
    // forceColorWrite true means "do not let the bloom manager disable
    // colorWrite". We set it to the inverse of bloomOnly so artists can
    // opt-in to bloom-only elements.
    (mat as MaterialWithUserData).userData.__copilot_forceColorWrite = !(bloomOnly === true);
    // Also expose an explicit bloomOnly flag for clarity/debugging.
    (mat as MaterialWithUserData).userData.__copilot_bloomOnly = Boolean(bloomOnly === true);
  } catch (error) {
    // Expected: Material userData may be read-only in some environments
    reportMaterialError('userData', 'ShaderMaterial', error);
  }

  return mat;
}

/**
 * Builds the basic (non-shader) fallback material for planet rings, used when
 * postprocessing is disabled.
 *
 * @param {{ tintColor?: string; opacity: number; bloomOnly: boolean }} opts - Fallback options.
 * @returns {MeshBasicMaterial}
 */
export function createPlanetRingBasicMaterial(opts: {
  tintColor?: string;
  opacity: number;
  bloomOnly: boolean;
}): MeshBasicMaterial {
  const { tintColor, opacity, bloomOnly } = opts;
  const color = colorFromConfig(tintColor ?? '#d9efff');
  const bm = new MeshBasicMaterial({
    color,
    transparent: true,
    opacity: Math.max(0.45, opacity),
    depthTest: true,
    depthWrite: false,
    side: DoubleSide,
    blending: NormalBlending,
  });
  try {
    if (!bm.userData) bm.userData = {};
    // For basic fallback, also respect bloomOnly: if bloomOnly is false
    // we want the material to remain color-write enabled always.
    (bm as MaterialWithUserData).userData.__copilot_forceColorWrite = !(bloomOnly === true);
    (bm as MaterialWithUserData).userData.__copilot_bloomOnly = Boolean(bloomOnly === true);
  } catch (error) {
    // Expected: Material userData may be read-only in some environments
    reportMaterialError('userData', 'MeshBasicMaterial', error);
  }
  return bm;
}
