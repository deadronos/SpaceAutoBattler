import { Vector3 } from 'three';
import type {
  AIState,
  BehaviorProfile,
  GameState,
  ShipEntity,
} from '../../../types/index.js';
import { AI_CONFIG, getEffectiveAIConfig } from '../../config.js';
import { SeededRng } from '../../../utils/rng.js';
import { hashToInt } from './utils.js';
import { dampVerticalAmplitude } from './hysteresis.js';

const TEMP_RNG = new SeededRng(1);

/** Reset module-level RNG used for vertical maneuvers. */
export function resetTempRng(seed?: number): void {
  TEMP_RNG.reset(seed ?? 1);
}

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
  const perturb = TEMP_RNG.normal(amplitude * 0.3, 0.05);
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

  const clampCfg = AI_CONFIG.verticalClamp ?? { default: AI_CONFIG.headingYClamp };
  const hull = ship.ship.hull;
  let baseClamp = Number(clampCfg.default ?? AI_CONFIG.headingYClamp);
  if (hull === 'destroyer' || hull === 'carrier') {
    baseClamp = Number(clampCfg.heavy ?? baseClamp);
  } else if (hull === 'fighter' || hull === 'corvette' || profile.style === 'escort') {
    baseClamp = Number(clampCfg.highAgility ?? baseClamp);
  }

  const desiredRange = ai.desiredRange ?? profile.desiredRange;
  let scale = 1;
  if (target && desiredRange) {
    const [desiredMin, desiredMax] = desiredRange;
    const span = Math.max(1, desiredMax - desiredMin);
    const distance = ship.transform.position.distanceTo(target.transform.position);
    const midpoint = (desiredMin + desiredMax) * 0.5;
    const deviation = Math.abs(distance - midpoint);
    const normalized = deviation / span;
    scale += Math.min(0.6, normalized * 0.75);
  }

  const amplitudeScale = 0.8 + Math.min(0.6, amplitude * 0.5);
  let clamp = baseClamp * scale * amplitudeScale;
  const heavyCap = Number(clampCfg.default ?? baseClamp);
  const agilityCap = Number(clampCfg.highAgility ?? clampCfg.default ?? baseClamp);
  if (hull === 'destroyer' || hull === 'carrier') {
    clamp = Math.min(clamp, heavyCap);
  } else {
    clamp = Math.min(clamp, agilityCap);
  }
  clamp = Math.max(0.1, Math.min(clamp, 0.7));
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
