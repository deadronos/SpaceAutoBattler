import { Vector3 } from 'three';
import type {
  AIState,
  AIMetrics,
  AITraits,
  BehaviorProfile,
  GameState,
  ShipEntity,
  Team,
} from '../../../types/index.js';
import { AI_CONFIG, getEffectiveAIConfig } from '../../config.js';
import { hashToInt } from './utils.js';
import { computeEffectiveDesiredRange } from './hysteresis.js';
import { getShipVelocity, computeInterceptHeadingVector } from '../../combat/aiming.js';

export const TEMP_DIR = new Vector3();
export const TEMP_POS = new Vector3();
export const TEMP_REL_POS = new Vector3();
export const TEMP_TARGET_VEL = new Vector3();
export const TEMP_SHIP_VEL = new Vector3();
export const TEMP_REL_VEL = new Vector3();

// Re-export for backward compatibility
// The re-exported symbols are intended for backward compatibility and may not
// be referenced locally in this module — silence the unused-var lint rule.

export { TEMP_RNG, resetTempRng } from './sharedRng.js';

/**
 * Helper function to get effective desired range, applying hysteresis if enabled.
 * Returns [desiredMin, desiredMax] tuple.
 */
export function getEffectiveRange(
  ship: ShipEntity,
  profile: BehaviorProfile,
  distance: number,
  tickIndex: number,
): [number, number] {
  let desiredMin = profile.desiredRange[0];
  let desiredMax = profile.desiredRange[1];
  if (getEffectiveAIConfig().hysteresisEnabled && ship.ai) {
    [desiredMin, desiredMax] = computeEffectiveDesiredRange(ship.ai, profile, distance, tickIndex);
  }
  return [desiredMin, desiredMax];
}

export interface IntentCandidate {
  intent: AIState['intent'];
  score: number;
  target?: ShipEntity | null;
  intentPriority?: number;
  threatRank?: number;
  distanceSq?: number;
  index?: number;
}

/**
 * Quantizes a score to a fixed precision to reduce floating point drift in metrics/debugging.
 *
 * @param {number} value - The raw score.
 * @returns {number} The quantized score.
 */
export function quantizeScore(value: number): number {
  const precision = AI_CONFIG.scorePrecision > 0 ? AI_CONFIG.scorePrecision : 0.1;
  if (!Number.isFinite(value)) return 0;
  const scaled = Math.round(value / precision) * precision;
  const rounded = Number(scaled.toFixed(3));
  return Number.isFinite(rounded) ? rounded : 0;
}

/**
 * Returns the priority index for an intent (lower is higher priority).
 *
 * @param {AIState['intent']} intent - The intent.
 * @returns {number} The priority index.
 */
export function getIntentPriority(intent: AIState['intent']): number {
  const order = AI_CONFIG.intentPriority;
  const idx = order.indexOf(intent);
  return idx >= 0 ? idx : order.length;
}

/**
 * Ensures default values are set for an intent candidate.
 *
 * @param {IntentCandidate} candidate - The candidate object.
 * @param {number} fallbackIndex - Fallback sort index.
 */
export function ensureCandidateDefaults(candidate: IntentCandidate, fallbackIndex: number): void {
  candidate.score = quantizeScore(candidate.score);
  if (candidate.intentPriority == null)
    candidate.intentPriority = getIntentPriority(candidate.intent);
  if (candidate.threatRank == null) candidate.threatRank = Number.POSITIVE_INFINITY;
  if (candidate.distanceSq == null) candidate.distanceSq = Number.POSITIVE_INFINITY;
  if (candidate.index == null) candidate.index = fallbackIndex;
  if (candidate.target === undefined) candidate.target = null;
}

/**
 * Comparator for sorting intent candidates.
 *
 * @param {IntentCandidate} a - First candidate.
 * @param {IntentCandidate} b - Second candidate.
 * @returns {number} Comparison result (<0, 0, >0).
 */
export function compareIntentCandidates(a: IntentCandidate, b: IntentCandidate): number {
  const SCORE_EPSILON = 1e-6;
  const scoreDiff = b.score - a.score;
  if (Math.abs(scoreDiff) > SCORE_EPSILON) return scoreDiff;
  const aPriority = a.intentPriority ?? getIntentPriority(a.intent);
  const bPriority = b.intentPriority ?? getIntentPriority(b.intent);
  if (aPriority !== bPriority) return aPriority - bPriority;
  const aThreat = a.threatRank ?? Number.POSITIVE_INFINITY;
  const bThreat = b.threatRank ?? Number.POSITIVE_INFINITY;
  if (aThreat !== bThreat) return aThreat - bThreat;
  const aDistance = a.distanceSq ?? Number.POSITIVE_INFINITY;
  const bDistance = b.distanceSq ?? Number.POSITIVE_INFINITY;
  if (aDistance !== bDistance) return aDistance - bDistance;
  const aIndex = a.index ?? 0;
  const bIndex = b.index ?? 0;
  return aIndex - bIndex;
}

export { getShipVelocity };

export function getSpeedMagnitude(ship: ShipEntity): number {
  const velocity = getShipVelocity(ship, TEMP_TARGET_VEL);
  return Math.sqrt(velocity.x * velocity.x + velocity.y * velocity.y + velocity.z * velocity.z);
}

export function computeThreatBonus(state: GameState, team: Team, targetId: number): number {
  const threat = state.blackboard.threatToVip;
  const ships = state.queries?.ships?.entities as ShipEntity[] | undefined;
  for (const [vipId, threatId] of threat.entries()) {
    if (threatId !== targetId) continue;
    const vip = state.shipById?.get(vipId) ?? ships?.find((ship) => ship.id === vipId) ?? null;
    if (vip && vip.ship.team === team) {
      return 180;
    }
  }
  return 0;
}

export function computeBandPreferenceBonus(
  distance: number,
  desiredMin: number,
  desiredMax: number,
  preference: BehaviorProfile['bandPreference'],
): number {
  if (!preference) return 0;
  const span = Math.max(1, desiredMax - desiredMin);
  if (preference === 'inner') {
    const closeness = Math.max(0, desiredMax - distance) / span;
    return closeness * 80;
  }
  if (preference === 'outer') {
    const closeness = Math.max(0, distance - desiredMin) / span;
    return closeness * 80;
  }
  const center = (desiredMin + desiredMax) * 0.5;
  const normalized = 1 - Math.min(1, Math.abs(distance - center) / (span * 0.5));
  return normalized * 60;
}

export { computeInterceptHeadingVector };

/**
 * Breaks a tie between top-scoring candidates using deterministic randomness.
 *
 * @param {AIState} ai - The AI state (for seed).
 * @param {number} tickIndex - The current tick index.
 * @param {IntentCandidate[]} candidates - The list of candidates (sorted).
 * @param {AIMetrics} [metrics] - Metrics object to record tie breaks.
 * @returns {IntentCandidate} The selected candidate.
 */
export function tieBreak(
  ai: AIState,
  tickIndex: number,
  candidates: IntentCandidate[],
  metrics?: AIMetrics,
): IntentCandidate {
  if (candidates.length === 0) {
    return {
      intent: 'Attack',
      score: 0,
      target: null,
      intentPriority: getIntentPriority('Attack'),
      threatRank: Number.POSITIVE_INFINITY,
      distanceSq: Number.POSITIVE_INFINITY,
      index: 0,
    };
  }

  for (let i = 0; i < candidates.length; i += 1) {
    ensureCandidateDefaults(candidates[i], i);
  }

  candidates.sort(compareIntentCandidates);

  const topScore = candidates[0].score;
  const tied: IntentCandidate[] = [];
  for (const candidate of candidates) {
    if (Math.abs(candidate.score - topScore) < 1e-5) {
      tied.push(candidate);
    } else {
      break;
    }
  }

  if (tied.length === 1) {
    return tied[0];
  }

  let winner = tied[0];
  for (let i = 1; i < tied.length; i += 1) {
    const contender = tied[i];
    if (compareIntentCandidates(contender, winner) < 0) {
      winner = contender;
    }
  }

  for (const contender of tied) {
    if (contender !== winner && compareIntentCandidates(contender, winner) === 0) {
      if (metrics) metrics.tieFallbacks += 1;
      const seed = ai.traitSeed ^ (tickIndex * 4099);
      const idx = Math.abs(hashToInt(seed)) % tied.length;
      return tied[idx];
    }
  }

  return winner;
}

/**
 * Get the distance between two ships' positions.
 */
export function getDistanceBetween(ship: ShipEntity, target: ShipEntity): number {
  return ship.transform.position.distanceTo(target.transform.position);
}

/**
 * Get the HP ratio of a ship (0.0 to 1.0).
 */
export function getHpRatio(ship: ShipEntity): number {
  return ship.ship.hp / Math.max(1, ship.ship.maxHp);
}

/**
 * Get the effective aggression value combining profile and traits.
 */
export function getEffectiveAggression(profile: BehaviorProfile, traits: AITraits): number {
  return profile.aggression * traits.aggression;
}

/**
 * Get the effective patience value combining profile and traits.
 */
export function getEffectivePatience(profile: BehaviorProfile, traits: AITraits): number {
  return profile.patience * traits.patience;
}

/**
 * Get the aggression multiplier for opening salvo phase.
 * Returns a multiplier based on whether the game is in the opening salvo period.
 */
export function getOpeningSalvoMultiplier(state: GameState): number {
  const cfg = getEffectiveAIConfig();
  const isOpeningSalvo = cfg.engagementBoostEnabled && state.time < cfg.openingSalvoDuration;
  return isOpeningSalvo ? cfg.openingSalvoAggressionBoost : 1.0;
}

/**
 * Get the focus fire load for a target on a given team.
 * Returns the number of ships currently focusing this target.
 */
export function getFocusFireLoad(state: GameState, team: Team, targetId: number): number {
  const focusMap = state.blackboard.focusFire?.[team];
  return focusMap ? (focusMap.get(targetId) ?? 0) : 0;
}

/**
 * Get the priority rank for a target on a given team.
 * Returns the rank if available, otherwise returns null.
 */
export function getPriorityRank(state: GameState, team: Team, targetId: number): number | null {
  const priorityIndex = state.blackboard.priorityIndex?.[team];
  if (!priorityIndex) return null;
  const rank = priorityIndex.get(targetId);
  return rank != null && Number.isFinite(rank) ? rank : null;
}
