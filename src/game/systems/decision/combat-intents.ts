import type {
  AITraits,
  BehaviorProfile,
  GameState,
  ShipEntity,
  TeamPosture,
} from '../../../types/index.js';
import {
  quantizeScore,
  computeBandPreferenceBonus,
  computeThreatBonus,
  getEffectiveRange,
  getDistanceBetween,
  getHpRatio,
  getEffectiveAggression,
  getEffectivePatience,
  getOpeningSalvoMultiplier,
  getFocusFireLoad,
  getPriorityRank,
} from './intent-utils.js';
import { getEffectiveAIConfig } from '../../config.js';

/**
 * Scores the 'Attack' intent for a given ship and target.
 *
 * @param {GameState} state - The game state.
 * @param {ShipEntity} ship - The AI ship.
 * @param {BehaviorProfile} profile - The behavior profile.
 * @param {ShipEntity | null} target - The target to attack.
 * @param {TeamPosture} posture - The team's posture.
 * @param {AITraits} traits - The AI's traits.
 * @returns {number} The calculated score.
 */
export function scoreAttackIntent(
  state: GameState,
  ship: ShipEntity,
  profile: BehaviorProfile,
  target: ShipEntity | null,
  posture: TeamPosture,
  traits: AITraits,
): number {
  if (!target) return 0;
  const dist = getDistanceBetween(ship, target);
  const [desiredMin, desiredMax] = getEffectiveRange(ship, profile, dist, state.ai.tickIndex);
  const mid = (desiredMin + desiredMax) * 0.5;
  const bandError = Math.abs(dist - mid);
  const hpRatio = getHpRatio(ship);
  const aggression = getEffectiveAggression(profile, traits);

  const aggressionMultiplier = getOpeningSalvoMultiplier(state);

  let score = 1000 - bandError * 4.6 + aggression * 120 * aggressionMultiplier;
  score += hpRatio * 80;
  if (posture === 'aggressive') score += 90 * aggressionMultiplier;
  if (posture === 'retreat') score -= 120;
  const bias = profile.classBias[target.ship.hull] ?? 0;
  score += bias;
  score += computeBandPreferenceBonus(dist, desiredMin, desiredMax, profile.bandPreference);
  const rank = getPriorityRank(state, ship.ship.team, target.id);
  if (rank !== null) {
    score += Math.max(0, 140 - rank * 12);
  }
  score += computeThreatBonus(state, ship.ship.team, target.id);
  const focusLoad = getFocusFireLoad(state, ship.ship.team, target.id);
  const focusBias = focusLoad === 0 ? 40 : Math.max(-80, 35 - focusLoad * 30);
  score += focusBias;
  const effectiveCfg = getEffectiveAIConfig();
  if (effectiveCfg.engagementBoostEnabled && profile.engagementBias) {
    score += profile.engagementBias;
  }
  return quantizeScore(score);
}

/**
 * Scores the 'Kite' intent.
 *
 * @param {ShipEntity} ship - The AI ship.
 * @param {BehaviorProfile} profile - The behavior profile.
 * @param {ShipEntity | null} target - The target to kite.
 * @param {TeamPosture} posture - The team's posture.
 * @param {AITraits} traits - The AI's traits.
 * @returns {number} The calculated score.
 */
export function scoreKiteIntent(
  ship: ShipEntity,
  profile: BehaviorProfile,
  target: ShipEntity | null,
  posture: TeamPosture,
  traits: AITraits,
): number {
  if (!target) return 100;
  const distance = getDistanceBetween(ship, target);
  const desiredMin = profile.desiredRange[0];
  const desiredMax = profile.desiredRange[1];
  const aggression = getEffectiveAggression(profile, traits);
  const hpRatio = getHpRatio(ship);
  let score = 320 + (distance - desiredMin) * 1.4 + aggression * 70;
  if (distance < desiredMin) score -= 120;
  if (distance > desiredMax * 1.25) score -= 90;
  if (posture === 'retreat') score += 80;
  if (posture === 'aggressive') score -= 60;
  score += (1 - hpRatio) * 200;
  return quantizeScore(score);
}

/**
 * Scores the 'Flee' intent.
 *
 * @param {ShipEntity} ship - The AI ship.
 * @param {BehaviorProfile} profile - The behavior profile.
 * @param {ShipEntity | null} target - The target (source of threat).
 * @param {TeamPosture} posture - The team's posture.
 * @param {AITraits} traits - The AI's traits.
 * @returns {number} The calculated score.
 */
export function scoreFleeIntent(
  ship: ShipEntity,
  profile: BehaviorProfile,
  target: ShipEntity | null,
  posture: TeamPosture,
  traits: AITraits,
): number {
  const hpRatio = getHpRatio(ship);
  const gate = profile.gates?.hpRetreatPct ?? 0.2;
  const patience = getEffectivePatience(profile, traits);
  if (hpRatio > gate && posture !== 'retreat') return quantizeScore(150 - patience * 40);
  const threat = target ? getDistanceBetween(ship, target) : profile.desiredRange[1];
  const nerve = 1 - Math.min(0.6, patience * 0.3);
  const dodge = 1 + (traits.dodge - 1) * 0.5;
  const base = 400 + (gate - hpRatio) * 400 * (1 + patience * 0.1);
  return quantizeScore((base + Math.max(0, 300 - threat) * dodge) * (1 + nerve * 0.25));
}
