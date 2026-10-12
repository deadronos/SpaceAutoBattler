import { ShaderMaterial, Vector4 } from 'three';
import type { ShieldRipple, ShipHull, Team } from '../../types/index.js';
import type { MaterialWithUserData } from '../../types/renderer.js';
import {
  getShieldVisuals,
  SHIELD_TUNING,
  TEAM_COLORS,
  SHIELD_RIPPLE_TUNING,
  RENDERER_VISUAL_CONFIG,
} from '../../config/renderer.js';
import { colorFromConfig } from '../../utils/color.js';
import {
  SHADER_MAX_RIPPLES,
  buildShieldHexFragmentShader,
  buildShieldHexVertexShader,
} from './shieldHexShaders.js';

export { SHADER_MAX_RIPPLES } from './shieldHexShaders.js';

export type ShieldHexMaterialProps = {
  hull: ShipHull;
  team: Team;
  opacity: number;
  ripple?: ShieldRipple | readonly ShieldRipple[];
  simTime?: number;
};

/**
 * Creates the shield hex `ShaderMaterial` for a hull/team (pure: no React).
 *
 * @param {ShipHull} hull - The ship hull (selects hex scale/edge tuning).
 * @param {Team} team - The owning team (selects tint/red boost).
 * @returns {ShaderMaterial} The configured shield material.
 */
export function createShieldHexShaderMaterial(hull: ShipHull, team: Team): ShaderMaterial {
  const { hexScale, edgeWidth, maxAlpha } = getShieldVisuals(hull);
  const mat = new ShaderMaterial({
    transparent: true,
    depthWrite: false,
    depthTest: SHIELD_TUNING.depthTest,
    // Low tier collapses the shield's 3 chromatic ripple evaluations to 1 at
    // compile time. Read from config (never React) to keep this boundary clean.
    ...(RENDERER_VISUAL_CONFIG.performanceTier === 'low' ? { defines: { LOW_QUALITY: '1' } } : {}),
    uniforms: {
      uTime: { value: 0 },
      uTint: { value: colorFromConfig(team === 'blue' ? TEAM_COLORS.blue : SHIELD_TUNING.redTint) },
      uTeamIsRed: { value: team === 'red' ? 1.0 : 0.0 },
      uEnableRedBoost: { value: SHIELD_TUNING.enableRedBoost ? 1.0 : 0.0 },
      uRedBoostPow: { value: SHIELD_TUNING.redBoostPower },
      uRedBoostMul: { value: SHIELD_TUNING.redBoostMultiplier },
      uEdgeAlphaMul: { value: SHIELD_TUNING.edgeAlphaMul },
      uFillAlphaMul: { value: SHIELD_TUNING.fillAlphaMul },
      uMinAlphaFloor: { value: SHIELD_TUNING.minAlphaFloor },
      uFillTintMul: { value: SHIELD_TUNING.fillTintMul },
      uOpacity: { value: 1 },
      uHexScale: { value: hexScale },
      uEdgeWidth: { value: edgeWidth },
      uMaxAlpha: { value: maxAlpha },
      uRippleCount: { value: 0 },
      uRippleData: {
        value: Array.from({ length: SHADER_MAX_RIPPLES }, () => new Vector4(0, 0, 1, 0)),
      },
      uRippleT0s: { value: Array.from({ length: SHADER_MAX_RIPPLES }, () => -999) },
      uRippleSpeed: { value: SHIELD_RIPPLE_TUNING.defaultSpeed },
      uRippleWidthBase: { value: SHIELD_RIPPLE_TUNING.baseWidth },
      uRippleBlendMode: { value: SHIELD_RIPPLE_TUNING.blendMode },
      uRippleIgnoreMaxAlpha: { value: SHIELD_RIPPLE_TUNING.ignoreMaxAlpha ? 1.0 : 0.0 },
      uRippleColorMul: { value: SHIELD_RIPPLE_TUNING.colorMul },
      uRippleStrength: { value: SHIELD_RIPPLE_TUNING.strength },
      uDisplacementScale: { value: SHIELD_RIPPLE_TUNING.displacementScale },
      uRippleTintMix: { value: SHIELD_RIPPLE_TUNING.tintMix },
    },
    vertexShader: buildShieldHexVertexShader(),
    fragmentShader: buildShieldHexFragmentShader(),
  });

  // Mark shield materials as force-write so the selective-bloom provider
  // will not disable their colorWrite when postprocessing/composer is active.
  try {
    if (!mat.userData) mat.userData = {};
    (mat as unknown as MaterialWithUserData).userData.__copilot_forceColorWrite = true;
  } catch {
    /* defensive: ignore in odd test environments */
  }

  return mat;
}
