import { Vector3 } from 'three';
import type {
  AIState,
  AIMetrics,
  BehaviorProfile,
  GameState,
  ShipEntity,
  Team,
} from '../../../types/index.js';
import { AI_CONFIG } from '../../config.js';
import { SeededRng } from '../../../utils/rng.js';
import { hashToInt } from './utils.js';

export const TEMP_DIR = new Vector3();
export const TEMP_POS = new Vector3();
export const TEMP_REL_POS = new Vector3();
export const TEMP_TARGET_VEL = new Vector3();
export const TEMP_SHIP_VEL = new Vector3();
export const TEMP_REL_VEL = new Vector3();
export const TEMP_RNG = new SeededRng(1);

/**
 * Reset the module-level temporary RNG used for incidental randomness in
 * decision utilities. Tests and harnesses can call this to ensure runs are
 * independent from previous test ordering.
 */
export function resetTempRng(seed?: number): void {
  TEMP_RNG.reset(seed ?? 1);
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

export function quantizeScore(value: number): number {
  const precision = AI_CONFIG.scorePrecision > 0 ? AI_CONFIG.scorePrecision : 0.1;
  if (!Number.isFinite(value)) return 0;
  const scaled = Math.round(value / precision) * precision;
  const rounded = Number(scaled.toFixed(3));
  return Number.isFinite(rounded) ? rounded : 0;
}

export function getIntentPriority(intent: AIState['intent']): number {
  const order = AI_CONFIG.intentPriority;
  const idx = order.indexOf(intent);
  return idx >= 0 ? idx : order.length;
}

export function ensureCandidateDefaults(candidate: IntentCandidate, fallbackIndex: number): void {
  candidate.score = quantizeScore(candidate.score);
  if (candidate.intentPriority == null)
    candidate.intentPriority = getIntentPriority(candidate.intent);
  if (candidate.threatRank == null) candidate.threatRank = Number.POSITIVE_INFINITY;
  if (candidate.distanceSq == null) candidate.distanceSq = Number.POSITIVE_INFINITY;
  if (candidate.index == null) candidate.index = fallbackIndex;
  if (candidate.target === undefined) candidate.target = null;
}

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

export function getShipVelocity(ship: ShipEntity, out: Vector3): Vector3 {
  const component = ship.ship;
  const velocity = component?.velocity;
  if (!velocity) {
    out.set(0, 0, 0);
    return out;
  }
  const x = Number.isFinite(velocity.x) ? velocity.x : 0;
  const y = Number.isFinite(velocity.y) ? velocity.y : 0;
  const z = Number.isFinite(velocity.z) ? velocity.z : 0;
  out.set(x, y, z);
  return out;
}

export function getSpeedMagnitude(ship: ShipEntity): number {
  const velocity = getShipVelocity(ship, TEMP_TARGET_VEL);
  return Math.sqrt(velocity.x * velocity.x + velocity.y * velocity.y + velocity.z * velocity.z);
}

export function computeThreatBonus(state: GameState, team: Team, targetId: number): number {
  const threat = state.blackboard.threatToVip;
  const ships = state.queries.ships.entities as ShipEntity[];
  for (const [vipId, threatId] of threat.entries()) {
    if (threatId !== targetId) continue;
    const vip = ships.find((s) => s.id === vipId);
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

export function computeInterceptHeadingVector(
  ship: ShipEntity,
  target: ShipEntity,
  out: Vector3,
): Vector3 {
  const projectileSpeed = Math.max(1, Math.max(ship.ship.projectileSpeed, ship.ship.speed * 0.75));
  const relativePos = TEMP_REL_POS.copy(target.transform.position).sub(ship.transform.position);
  const targetVel = getShipVelocity(target, TEMP_TARGET_VEL);
  const shipVel = getShipVelocity(ship, TEMP_SHIP_VEL);
  const relativeVel = TEMP_REL_VEL.copy(targetVel).sub(shipVel);

  const a = relativeVel.lengthSq() - projectileSpeed * projectileSpeed;
  const b = 2 * relativeVel.dot(relativePos);
  const c = relativePos.lengthSq();

  let t = 0;
  if (Math.abs(a) < 1e-5) {
    t = b !== 0 ? Math.max(0, -c / b) : 0;
  } else {
    const discriminant = b * b - 4 * a * c;
    if (discriminant >= 0) {
      const sqrt = Math.sqrt(discriminant);
      const t1 = (-b - sqrt) / (2 * a);
      const t2 = (-b + sqrt) / (2 * a);
      t = Math.min(t1, t2);
      if (t < 0) t = Math.max(t1, t2);
      if (t < 0) t = 0;
    } else {
      t = Math.max(0, -b / (2 * a));
    }
  }

  t = Math.min(Math.max(t, 0), 2.5);
  const future = out.copy(target.transform.position).addScaledVector(targetVel, t);
  future.sub(ship.transform.position);
  if (future.lengthSq() < 1e-5) {
    out.copy(relativePos);
  } else {
    out.copy(future);
  }
  if (out.lengthSq() < 1e-5) {
    out.set(0, 0, 1).applyQuaternion(ship.transform.rotation);
  } else {
    out.normalize();
  }
  return out;
}

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
