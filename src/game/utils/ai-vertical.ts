import type { GameState, ShipEntity, BehaviorProfile, AIState } from '../../types/index.js';
import { AI_CONFIG } from '../config.js';
import { clamp } from '../../utils/math.js';

/**
 * Compute the effective vertical clamp for the given ship/profile/AI state.
 * Centralized so callers outside the decision/ folder can use the same logic.
 *
 * @param {GameState} state - The game state.
 * @param {ShipEntity} ship - The ship entity.
 * @param {BehaviorProfile} profile - The AI behavior profile.
 * @param {AIState} ai - The AI state.
 * @param {ShipEntity | null} target - The current target entity.
 * @returns {number} The calculated vertical clamp value (0..1).
 */
export function computeVerticalClamp(
  state: GameState,
  ship: ShipEntity,
  profile: BehaviorProfile,
  ai: AIState,
  target: ShipEntity | null,
): number {
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

  const amplitudeScale = 0.8 + Math.min(0.6, (profile.verticalManeuver ?? 0) * 0.5);
  let clampValue = baseClamp * scale * amplitudeScale;
  const heavyCap = Number(clampCfg.default ?? baseClamp);
  const agilityCap = Number(clampCfg.highAgility ?? clampCfg.default ?? baseClamp);
  if (hull === 'destroyer' || hull === 'carrier') {
    clampValue = Math.min(clampValue, heavyCap);
  } else {
    clampValue = Math.min(clampValue, agilityCap);
  }
  clampValue = clamp(clampValue, 0.1, 0.7);
  return clampValue;
}
