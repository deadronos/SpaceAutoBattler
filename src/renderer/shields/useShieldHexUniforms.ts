import { useCallback, useEffect } from 'react';
import { Vector3, type ShaderMaterial } from 'three';
import { useFrame } from '@react-three/fiber';
import type { ShieldRipple, Team } from '../../types/index.js';
import type { ShieldHexUniforms } from '../../types/renderer.js';
import { SHIELD_TUNING, TEAM_COLORS, SHIELD_RIPPLE_TUNING } from '../../config/renderer.js';
import { colorFromConfig } from '../../utils/color.js';
import { SHADER_MAX_RIPPLES } from './shieldHexShaders.js';

const DEFAULT_RIPPLE_DIR = new Vector3(0, 0, 1);

/**
 * Drives a shield hex material's uniforms: advances time each frame, and syncs
 * opacity, team tint, and the packed ripple data (dir/amp/t0) from props.
 *
 * @param {ShaderMaterial} mat - The shield material.
 * @param {Team} team - Owning team (tint/red boost).
 * @param {number} opacity - Shield opacity (0..1).
 * @param {ShieldRipple | readonly ShieldRipple[]} [ripple] - Active ripple(s).
 * @param {number} [simTime] - Simulation time used to bias ripple start times.
 */
export function useShieldHexUniforms(
  mat: ShaderMaterial,
  team: Team,
  opacity: number,
  ripple: ShieldRipple | readonly ShieldRipple[] | undefined,
  simTime: number | undefined,
): void {
  const uniforms = mat.uniforms as unknown as ShieldHexUniforms;

  const handleFrame = useCallback(
    (_state: unknown, dt: number) => {
      uniforms.uTime.value += dt;
    },
    [uniforms],
  );

  useFrame(handleFrame);

  useEffect(() => {
    uniforms.uOpacity.value = Math.max(0, Math.min(1, opacity));
  }, [opacity, uniforms]);

  useEffect(() => {
    uniforms.uTint.value.copy(
      colorFromConfig(team === 'blue' ? TEAM_COLORS.blue : SHIELD_TUNING.redTint),
    );
    uniforms.uTeamIsRed.value = team === 'red' ? 1.0 : 0.0;
    uniforms.uEnableRedBoost.value = SHIELD_TUNING.enableRedBoost ? 1.0 : 0.0;
    uniforms.uRedBoostPow.value = SHIELD_TUNING.redBoostPower;
    uniforms.uRedBoostMul.value = SHIELD_TUNING.redBoostMultiplier;
  }, [team, uniforms]);

  useEffect(() => {
    const list = !ripple ? [] : 'dir' in ripple ? [ripple] : ripple;
    updateShieldHexRipples(uniforms, list, simTime ?? 0);
  }, [ripple, simTime, uniforms]);
}

/** Pack the active ripple queue into the material's preallocated uniform arrays. */
export function updateShieldHexRipples(
  uniforms: ShieldHexUniforms,
  list: readonly ShieldRipple[],
  simTime: number,
): void {
  const maxRipples = Math.min(SHIELD_RIPPLE_TUNING.maxRipples ?? 3, SHADER_MAX_RIPPLES);
  const bias = uniforms.uTime.value - simTime;
  const take = Math.min(list.length, maxRipples);
  for (let i = 0; i < take; i++) {
    const entry = list[list.length - take + i];
    if (!entry) continue;
    const amp = Math.min(1.6, 0.25 + (entry.amp ?? 0) * (SHIELD_RIPPLE_TUNING.ampScale ?? 1.9));
    const dir = entry.dir ?? DEFAULT_RIPPLE_DIR;
    uniforms.uRippleData.value[i]?.set(dir.x, dir.y, dir.z, amp);
    uniforms.uRippleT0s.value[i] = bias + (entry.t0 ?? 0);
  }
  uniforms.uRippleCount.value = take;
  uniforms.uRippleSpeed.value = SHIELD_RIPPLE_TUNING.defaultSpeed;
  uniforms.uRippleWidthBase.value = SHIELD_RIPPLE_TUNING.baseWidth;
  uniforms.uRippleBlendMode.value = SHIELD_RIPPLE_TUNING.blendMode;
  uniforms.uRippleIgnoreMaxAlpha.value = SHIELD_RIPPLE_TUNING.ignoreMaxAlpha ? 1.0 : 0.0;
  uniforms.uRippleColorMul.value = SHIELD_RIPPLE_TUNING.colorMul;
  uniforms.uRippleStrength.value = SHIELD_RIPPLE_TUNING.strength;
  uniforms.uDisplacementScale.value = SHIELD_RIPPLE_TUNING.displacementScale;
  uniforms.uRippleTintMix.value = SHIELD_RIPPLE_TUNING.tintMix;
}
