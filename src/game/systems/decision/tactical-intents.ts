import type {
  AITraits,
  BehaviorProfile,
  EscortAssignment,
  GameState,
  ShipEntity,
  TeamPosture,
} from '../../../types/index.js';
import { AI_CONFIG } from '../../config.js';
import {
  quantizeScore,
  computeBandPreferenceBonus,
  computeThreatBonus,
  getSpeedMagnitude,
  getEffectiveRange,
  getDistanceBetween,
  getEffectiveAggression,
  getEffectivePatience,
  getOpeningSalvoMultiplier,
  getFocusFireLoad,
  getPriorityRank,
} from './intent-utils.js';

/**
 * Scores the 'Intercept' intent.
 *
 * @param {GameState} state - The game state.
 * @param {ShipEntity} ship - The AI ship.
 * @param {BehaviorProfile} profile - The behavior profile.
 * @param {ShipEntity} target - The target to intercept.
 * @param {ShipEntity | null} escortTarget - The escort target (if any).
 * @param {TeamPosture} posture - The team's posture.
 * @param {AITraits} traits - The AI's traits.
 * @param {EscortAssignment | null} escortAssignment - Escort details.
 * @returns {number} The calculated score.
 */
export function scoreInterceptIntent(
  state: GameState,
  ship: ShipEntity,
  profile: BehaviorProfile,
  target: ShipEntity,
  escortTarget: ShipEntity | null,
  posture: TeamPosture,
  traits: AITraits,
  escortAssignment: EscortAssignment | null,
): number {
  const style = profile.style;
  if (style !== 'escort' && style !== 'brawler' && style !== 'artillery') {
    return quantizeScore(180);
  }

  const distance = getDistanceBetween(ship, target);
  const [desiredMin, desiredMax] = getEffectiveRange(ship, profile, distance, state.ai.tickIndex);
  const bandPressure = Math.max(0, distance - desiredMax);

  const targetSpeed = getSpeedMagnitude(target);
  const threatBonus = computeThreatBonus(state, ship.ship.team, target.id);
  const escortBonus = escortAssignment && escortAssignment.threatId === target.id ? 80 : 0;
  const aggression = getEffectiveAggression(profile, traits);

  const aggressionMultiplier = getOpeningSalvoMultiplier(state);

  let score =
    480 +
    bandPressure * 2 +
    targetSpeed * 12 +
    aggression * 108 * aggressionMultiplier +
    threatBonus +
    escortBonus;
  if (posture === 'aggressive') score += 100 * aggressionMultiplier;
  if (posture === 'retreat') score -= 110;
  score += computeBandPreferenceBonus(distance, desiredMin, desiredMax, profile.bandPreference);
  const rank = getPriorityRank(state, ship.ship.team, target.id);
  if (rank !== null) {
    score += Math.max(0, 120 - rank * 10);
  }
  const focusLoad = getFocusFireLoad(state, ship.ship.team, target.id);
  score += Math.max(-70, 28 - focusLoad * 24);
  if (AI_CONFIG.engagementBoostEnabled && profile.engagementBias) {
    score += profile.engagementBias;
  }

  return quantizeScore(score);
}

/**
 * Scores the 'Reposition' intent.
 *
 * @param {GameState} state - The game state.
 * @param {ShipEntity} ship - The AI ship.
 * @param {BehaviorProfile} profile - The behavior profile.
 * @param {ShipEntity | null} target - The target (optional).
 * @param {AITraits} traits - The AI's traits.
 * @param {TeamPosture} posture - The team's posture.
 * @returns {number} The calculated score.
 */
export function scoreRepositionIntent(
  state: GameState,
  ship: ShipEntity,
  profile: BehaviorProfile,
  target: ShipEntity | null,
  traits: AITraits,
  posture: TeamPosture,
): number {
  const patience = getEffectivePatience(profile, traits);
  const centroid = state.blackboard.allyCentroid[ship.ship.team];
  if (!target) {
    const centroidDist = ship.transform.position.distanceTo(centroid);
    const desire = profile.desiredRange[0];
    const spacing = Math.max(0, centroidDist - desire * 1.5);
    let base = 220 + spacing * 1.2 + patience * 70;
    if (posture === 'hold') base += 50;
    if (posture === 'retreat') base -= 40;
    return quantizeScore(base);
  }

  const distance = getDistanceBetween(ship, target);
  const [desiredMin, desiredMax] = getEffectiveRange(ship, profile, distance, state.ai.tickIndex);
  const below = Math.max(0, desiredMin - distance);
  const above = Math.max(0, distance - desiredMax);
  let bandError = Math.abs(distance - (desiredMin + desiredMax) * 0.5);

  let score = 260 + (below + above) * 1.6 + bandError * 0.9 + patience * 80;
  if (profile.style === 'artillery') score += 150;
  if (profile.style === 'kiter') score += 90;
  if (posture === 'retreat') score -= 60;
  score += computeBandPreferenceBonus(distance, desiredMin, desiredMax, profile.bandPreference);
  return quantizeScore(score);
}
