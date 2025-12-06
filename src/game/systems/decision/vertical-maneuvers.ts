import { Vector3 } from 'three';
import type { AIState, BehaviorProfile, GameState, ShipEntity } from '../../../types/index.js';
import { AI_CONFIG, getEffectiveAIConfig } from '../../config.js';
import { computeVerticalClamp } from '../../utils/ai-vertical.js';
import { hashToInt } from './utils.js';
import { dampVerticalAmplitude } from './hysteresis.js';
import { TEMP_RNG } from './sharedRng.js';

// Re-export for backward compatibility
// This symbol is provided for backward compatibility and may be unused within
// this module; disable the unused-var lint warning for this line.
 
export { resetTempRng } from './sharedRng.js';

/**
 * Applies vertical perturbations to the ship's heading for evasion and 3D movement.
 * Modifies the heading vector in-place.
 *
 * @param {GameState} state - The game state.
 * @param {ShipEntity} ship - The ship entity.
 * @param {AIState} ai - The AI state.
 * @param {BehaviorProfile} profile - The behavior profile.
 * @param {Vector3} heading - The heading vector to perturb.
 * @param {ShipEntity | null} target - The current target.
 */
export function applyVerticalPerturbation(
  state: GameState,
  ship: ShipEntity,
  ai: AIState,
  profile: BehaviorProfile,
  heading: Vector3,
  target: ShipEntity | null,
): void {
  if (!AI_CONFIG.verticalEnabled) return;
  let amplitude = profile.verticalManeuver;
  if (amplitude <= 0) return;
  // Optionally apply damping based on recent vertical amplitude history to
  // reduce sustained 'bobbing' when repeated high amplitudes are observed.
  if (getEffectiveAIConfig().verticalDampingEnabled) {
    amplitude = dampVerticalAmplitude(ai, profile, amplitude, state.ai.tickIndex);
  }
  if (heading.lengthSq() < 1e-6) return;
  const seed = Math.abs(hashToInt(ai.traitSeed ^ ship.id ^ (state.ai.tickIndex * 1229))) + 1;
  TEMP_RNG.reset(seed);
  let perturb = TEMP_RNG.normal(amplitude * 0.3, 0.05);
  // When smoothing is enabled, attenuate the raw vertical perturbation so
  // the smoothing filter can more effectively reduce jitter. This avoids
  // pathological cases where perturbations are large enough to increase
  // apparent heading variance after filtering.
  if (getEffectiveAIConfig().smoothingEnabled) {
    // Reduce perturbation amplitude by ~40% when smoothing active
    // (empirically chosen to keep behavior similar while improving stability).
    perturb *= 0.6;
  }
  heading.y += perturb;

  if (target) {
    const deltaY = target.transform.position.y - ship.transform.position.y;
    if (profile.elevationPreference === 'above') {
      heading.y += (0.2 + deltaY * 0.0015) * amplitude;
    } else if (profile.elevationPreference === 'below') {
      heading.y -= (0.2 + deltaY * 0.0015) * amplitude;
    } else if (profile.elevationPreference === 'follow') {
      heading.y += deltaY * 0.0008 * amplitude;
    }
  }

  const clamp = computeVerticalClamp(state, ship, profile, ai, target);
  heading.y = Math.max(-clamp, Math.min(clamp, heading.y));

  const metrics = state.ai?.metrics;
  if (metrics) {
    const amplitudeSample = Math.abs(heading.y);
    metrics.headingAmplitudeSamples += 1;
    metrics.headingAmplitudeSum += amplitudeSample;
    if (amplitudeSample < metrics.headingAmplitudeMin) {
      metrics.headingAmplitudeMin = amplitudeSample;
    }
    if (amplitudeSample > metrics.headingAmplitudeMax) {
      metrics.headingAmplitudeMax = amplitudeSample;
    }
  }
}
