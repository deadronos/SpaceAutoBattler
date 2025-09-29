import { Vector3 } from 'three';
import type {
  AIState,
  AITraits,
  AIMetrics,
  BehaviorProfile,
  EscortAssignment,
  GameState,
  ShipEntity,
  Team,
  TeamPosture,
  EntityId,
} from '../../../types/index.js';
import { AI_CONFIG } from '../../config.js';
import { SeededRng } from '../../../utils/rng.js';
import { hashToInt } from './utils.js';

const TEMP_DIR = new Vector3();
const TEMP_POS = new Vector3();
const TEMP_REL_POS = new Vector3();
const TEMP_TARGET_VEL = new Vector3();
const TEMP_SHIP_VEL = new Vector3();
const TEMP_REL_VEL = new Vector3();
const TEMP_RNG = new SeededRng(1);

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
  if (candidate.intentPriority == null) candidate.intentPriority = getIntentPriority(candidate.intent);
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

export function selectIntent(
  state: GameState,
  ship: ShipEntity,
  ai: AIState,
  profile: BehaviorProfile,
  primaryTarget: ShipEntity | null,
  escortTarget: ShipEntity | null,
  escortAssignment: EscortAssignment | null,
): IntentCandidate {
  const candidates: IntentCandidate[] = [];
  const posture = state.blackboard.teamPosture[ship.ship.team];
  const traits = ai.traits;

  const attackScore = scoreAttackIntent(state, ship, profile, primaryTarget, posture, traits);
  candidates.push({ intent: 'Attack', score: attackScore, target: primaryTarget });

  const kiteScore = scoreKiteIntent(ship, profile, primaryTarget, posture, traits);
  candidates.push({ intent: 'Kite', score: kiteScore, target: primaryTarget });

  if (escortTarget) {
    const escortScore = scoreEscortIntent(ship, profile, escortTarget, state, traits, escortAssignment);
    candidates.push({ intent: 'Escort', score: escortScore, target: escortTarget });
  }

  if (primaryTarget) {
    const interceptScore = scoreInterceptIntent(
      state,
      ship,
      profile,
      primaryTarget,
      escortTarget,
      posture,
      traits,
      escortAssignment,
    );
    candidates.push({ intent: 'Intercept', score: interceptScore, target: primaryTarget });

    const repositionScore = scoreRepositionIntent(state, ship, profile, primaryTarget, traits, posture);
    candidates.push({ intent: 'Reposition', score: repositionScore, target: primaryTarget });
  } else {
    const repositionScore = scoreRepositionIntent(state, ship, profile, null, traits, posture);
    candidates.push({ intent: 'Reposition', score: repositionScore });
  }

  const regroupScore = scoreRegroupIntent(state, ship, profile, posture, traits);
  candidates.push({ intent: 'Regroup', score: regroupScore });

  const fleeScore = scoreFleeIntent(ship, profile, primaryTarget, posture, traits);
  candidates.push({ intent: 'Flee', score: fleeScore, target: primaryTarget });

  if (
    AI_CONFIG.engagementBoostEnabled &&
    state.time <= AI_CONFIG.openingSalvoDuration &&
    state.blackboard.strengthRatio[ship.ship.team] <= AI_CONFIG.strengthRatioThreshold
  ) {
    for (const candidate of candidates) {
      if (candidate.intent === 'Attack' || candidate.intent === 'Intercept') {
        candidate.score = quantizeScore(candidate.score * 1.2);
      }
    }
  }

  const priorityLookup = state.blackboard.priorityIndex[ship.ship.team];
  let candidateIndex = 0;
  for (const candidate of candidates) {
    candidate.score = quantizeScore(candidate.score);
    candidate.intentPriority = getIntentPriority(candidate.intent);
    const targetEntity = candidate.target ?? null;
    candidate.target = targetEntity;
    candidate.distanceSq = targetEntity
      ? ship.transform.position.distanceToSquared(targetEntity.transform.position)
      : Number.POSITIVE_INFINITY;
    const rank = targetEntity ? priorityLookup.get(targetEntity.id) ?? Number.POSITIVE_INFINITY : Number.POSITIVE_INFINITY;
    candidate.threatRank = rank;
    candidate.index = candidateIndex;
    candidateIndex += 1;
  }

  return tieBreak(ai, state.ai.tickIndex, candidates, state.ai.metrics);
}

export function scoreAttackIntent(
  state: GameState,
  ship: ShipEntity,
  profile: BehaviorProfile,
  target: ShipEntity | null,
  posture: TeamPosture,
  traits: AITraits,
): number {
  if (!target) return 0;
  const desiredMin = profile.desiredRange[0];
  const desiredMax = profile.desiredRange[1];
  const dist = ship.transform.position.distanceTo(target.transform.position);
  const mid = (desiredMin + desiredMax) * 0.5;
  const bandError = Math.abs(dist - mid);
  const hpRatio = ship.ship.hp / Math.max(1, ship.ship.maxHp);
  const aggression = profile.aggression * traits.aggression;

  const isOpeningSalvo = AI_CONFIG.engagementBoostEnabled && state.time < AI_CONFIG.openingSalvoDuration;
  const aggressionMultiplier = isOpeningSalvo ? AI_CONFIG.openingSalvoAggressionBoost : 1.0;

  let score = 1000 - bandError * 4.6 + aggression * 120 * aggressionMultiplier;
  score += hpRatio * 80;
  if (posture === 'aggressive') score += 90 * aggressionMultiplier;
  if (posture === 'retreat') score -= 120;
  const bias = profile.classBias[target.ship.hull] ?? 0;
  score += bias;
  score += computeBandPreferenceBonus(dist, desiredMin, desiredMax, profile.bandPreference);
  const priorityIndex = state.blackboard.priorityIndex?.[ship.ship.team];
  if (priorityIndex) {
    const rank = priorityIndex.get(target.id);
    if (rank != null && Number.isFinite(rank)) {
      score += Math.max(0, 140 - rank * 12);
    }
  }
  score += computeThreatBonus(state, ship.ship.team, target.id);
  const focusMap = state.blackboard.focusFire?.[ship.ship.team];
  const focusLoad = focusMap ? focusMap.get(target.id) ?? 0 : 0;
  const focusBias = focusLoad === 0 ? 40 : Math.max(-80, 35 - focusLoad * 30);
  score += focusBias;
  if (AI_CONFIG.engagementBoostEnabled && profile.engagementBias) {
    score += profile.engagementBias;
  }
  return quantizeScore(score);
}

function computeBandPreferenceBonus(
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

  const distance = ship.transform.position.distanceTo(target.transform.position);
  const desiredMax = profile.desiredRange[1];
  const bandPressure = Math.max(0, distance - desiredMax);

  const targetSpeed = getSpeedMagnitude(target);
  const threatBonus = computeThreatBonus(state, ship.ship.team, target.id);
  const escortBonus = escortAssignment && escortAssignment.threatId === target.id ? 80 : 0;
  const aggression = profile.aggression * traits.aggression;

  const isOpeningSalvo = AI_CONFIG.engagementBoostEnabled && state.time < AI_CONFIG.openingSalvoDuration;
  const aggressionMultiplier = isOpeningSalvo ? AI_CONFIG.openingSalvoAggressionBoost : 1.0;

  let score = 480 + bandPressure * 2 + targetSpeed * 12 + aggression * 108 * aggressionMultiplier + threatBonus + escortBonus;
  if (posture === 'aggressive') score += 100 * aggressionMultiplier;
  if (posture === 'retreat') score -= 110;
  score += computeBandPreferenceBonus(distance, profile.desiredRange[0], desiredMax, profile.bandPreference);
  const interceptIndex = state.blackboard.priorityIndex?.[ship.ship.team];
  if (interceptIndex) {
    const interceptRank = interceptIndex.get(target.id);
    if (interceptRank != null && Number.isFinite(interceptRank)) {
      score += Math.max(0, 120 - interceptRank * 10);
    }
  }
  const focusMap = state.blackboard.focusFire?.[ship.ship.team];
  const interceptFocusLoad = focusMap ? focusMap.get(target.id) ?? 0 : 0;
  score += Math.max(-70, 28 - interceptFocusLoad * 24);
  if (AI_CONFIG.engagementBoostEnabled && profile.engagementBias) {
    score += profile.engagementBias;
  }

  return quantizeScore(score);
}

export function scoreRepositionIntent(
  state: GameState,
  ship: ShipEntity,
  profile: BehaviorProfile,
  target: ShipEntity | null,
  traits: AITraits,
  posture: TeamPosture,
): number {
  const patience = profile.patience * traits.patience;
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

  const desiredMin = profile.desiredRange[0];
  const desiredMax = profile.desiredRange[1];
  const distance = ship.transform.position.distanceTo(target.transform.position);
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

export function scoreRegroupIntent(
  state: GameState,
  ship: ShipEntity,
  profile: BehaviorProfile,
  posture: TeamPosture,
  traits: AITraits,
): number {
  const centroid = state.blackboard.allyCentroid[ship.ship.team];
  const distance = ship.transform.position.distanceTo(centroid);
  const hpRatio = ship.ship.hp / Math.max(1, ship.ship.maxHp);
  const gate = profile.gates?.hpRetreatPct ?? 0.3;
  const patience = profile.patience * traits.patience;

  if (posture === 'retreat' || hpRatio <= gate + 0.05) {
    let score = 420 + distance * 1.1 + (1 - hpRatio) * 260 + patience * 90;
    if (posture === 'retreat') score += 140;
    return quantizeScore(score);
  }

  if (distance > profile.desiredRange[1] * 2.5) {
    return quantizeScore(260 + distance * 0.8 + patience * 60);
  }

  return quantizeScore(180);
}

export function scoreKiteIntent(
  ship: ShipEntity,
  profile: BehaviorProfile,
  target: ShipEntity | null,
  posture: TeamPosture,
  traits: AITraits,
): number {
  if (!target) return 100;
  const distance = ship.transform.position.distanceTo(target.transform.position);
  const desiredMin = profile.desiredRange[0];
  const desiredMax = profile.desiredRange[1];
  const aggression = profile.aggression * traits.aggression;
  const hpRatio = ship.ship.hp / Math.max(1, ship.ship.maxHp);
  let score = 320 + (distance - desiredMin) * 1.4 + aggression * 70;
  if (distance < desiredMin) score -= 120;
  if (distance > desiredMax * 1.25) score -= 90;
  if (posture === 'retreat') score += 80;
  if (posture === 'aggressive') score -= 60;
  score += (1 - hpRatio) * 200;
  return quantizeScore(score);
}

export function scoreEscortIntent(
  ship: ShipEntity,
  profile: BehaviorProfile,
  escortTarget: ShipEntity,
  state: GameState,
  traits: AITraits,
  escortAssignment: EscortAssignment | null,
): number {
  const dist = ship.transform.position.distanceTo(escortTarget.transform.position);
  const threatId = escortAssignment ? escortAssignment.threatId : state.blackboard.threatToVip.get(escortTarget.id);
  const threatWeight = threatId != null ? 220 : 0;
  const desiredRadius = escortAssignment?.offset.length() ?? profile.desiredRange[0];
  const bandError = Math.abs(dist - desiredRadius);
  const patience = profile.patience * traits.patience;
  const assignmentBonus = escortAssignment ? 120 : 0;
  return quantizeScore(700 - bandError * 2 + patience * 90 + threatWeight + assignmentBonus);
}

export function scoreFleeIntent(
  ship: ShipEntity,
  profile: BehaviorProfile,
  target: ShipEntity | null,
  posture: TeamPosture,
  traits: AITraits,
): number {
  const hpRatio = ship.ship.hp / Math.max(1, ship.ship.maxHp);
  const gate = profile.gates?.hpRetreatPct ?? 0.2;
  const patience = profile.patience * traits.patience;
  if (hpRatio > gate && posture !== 'retreat') return quantizeScore(150 - patience * 40);
  const threat = target ? ship.transform.position.distanceTo(target.transform.position) : profile.desiredRange[1];
  const nerve = 1 - Math.min(0.6, patience * 0.3);
  const dodge = 1 + (traits.dodge - 1) * 0.5;
  const base = 400 + (gate - hpRatio) * 400 * (1 + patience * 0.1);
  return quantizeScore((base + Math.max(0, 300 - threat) * dodge) * (1 + nerve * 0.25));
}

function getSpeedMagnitude(ship: ShipEntity): number {
  const velocity = getShipVelocity(ship, TEMP_TARGET_VEL);
  return Math.sqrt(velocity.x * velocity.x + velocity.y * velocity.y + velocity.z * velocity.z);
}

function getShipVelocity(ship: ShipEntity, out: Vector3): Vector3 {
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

function computeThreatBonus(state: GameState, team: Team, targetId: number): number {
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

export function computeLod(
  ship: ShipEntity,
  target: ShipEntity | null,
  profile: BehaviorProfile,
): 0 | 1 | 2 {
  if (!target) return 2;
  if (ship.ship.hull === 'carrier' || ship.ship.hull === 'destroyer') return 0;
  const dist = ship.transform.position.distanceTo(target.transform.position);
  const active = Math.max(profile.desiredRange[1], AI_CONFIG.lod.activeDistance);
  if (dist <= active) return 0;
  if (dist <= AI_CONFIG.lod.idleDistance) return 1;
  return 2;
}

export function writeCommand(
  state: GameState,
  ship: ShipEntity,
  ai: AIState,
  profile: BehaviorProfile,
  target: ShipEntity | null,
  escortTarget: ShipEntity | null,
  escortAssignment: EscortAssignment | null,
): void {
  const command = ai.command;
  const heading = command.heading;
  command.ttl = state.ai.tickInterval;

  if (ai.intent !== 'Attack' && ai.intent !== 'Intercept' && ai.intent !== 'Reposition') {
    ai.stickinessUntil = 0;
    ai.stickinessTargetId = undefined;
  }

  let distanceToTarget: number | null = null;

  switch (ai.intent) {
    case 'Intercept':
      if (target) {
        computeInterceptHeadingVector(ship, target, heading);
        const distance = ship.transform.position.distanceTo(target.transform.position);
        distanceToTarget = distance;
        command.thrust = 1;
        command.firePrimary = distance <= ship.ship.range * 1.15;
        command.targetId = target.id;
      } else {
        heading.set(0, 0, 1).applyQuaternion(ship.transform.rotation);
        command.thrust = 0.8;
        command.firePrimary = false;
        command.targetId = undefined;
      }
      break;
    case 'Reposition':
      if (target) {
        heading.copy(target.transform.position).sub(ship.transform.position);
        let distance = heading.length();
        if (distance > 1e-5) {
          heading.divideScalar(distance);
          const tangent = TEMP_REL_POS.set(-heading.z, 0, heading.x);
          const hash = hashToInt(ship.id ^ (state.ai.tickIndex * 491));
          if (tangent.lengthSq() > 1e-5) {
            tangent.normalize();
            if (hash & 1) tangent.negate();
            heading.multiplyScalar(0.6).addScaledVector(tangent, 0.4).normalize();
          }
        } else {
          heading.set(0, 0, 1).applyQuaternion(ship.transform.rotation);
          distance = 0;
        }
        distanceToTarget = ship.transform.position.distanceTo(target.transform.position);
        const desiredMin = profile.desiredRange[0];
        const desiredMax = profile.desiredRange[1];
        let shouldFire = distance <= ship.ship.range;
        if (distance > desiredMax * 1.05) {
          command.thrust = 0.95;
        } else if (distance < desiredMin * 0.95) {
          heading.negate();
          heading.normalize();
          command.thrust = 0.6;
          shouldFire = false;
        } else {
          command.thrust = profile.style === 'artillery' ? 0.3 : 0.45;
          if (shouldFire) {
            shouldFire = distance >= desiredMin && distance <= desiredMax;
          }
        }
        command.firePrimary = shouldFire;
        command.targetId = target.id;
      } else {
        const centroid = state.blackboard.allyCentroid[ship.ship.team];
        heading.copy(centroid).sub(ship.transform.position);
        if (heading.lengthSq() < 1e-5) {
          heading.set(0, 0, 1).applyQuaternion(ship.transform.rotation);
        } else {
          heading.normalize();
        }
        command.thrust = 0.55;
        command.firePrimary = false;
        command.targetId = undefined;
      }
      break;
    case 'Regroup':
      {
        const centroid = state.blackboard.allyCentroid[ship.ship.team];
        heading.copy(centroid).sub(ship.transform.position);
        if (heading.lengthSq() < 1e-5) {
          heading.set(0, 0, 1).applyQuaternion(ship.transform.rotation);
        } else {
          heading.normalize();
        }
        const hpRatio = ship.ship.hp / Math.max(1, ship.ship.maxHp);
        const urgency = 1 + Math.max(0, 1 - hpRatio) * 0.5;
        const posture = state.blackboard.teamPosture[ship.ship.team];
        const base = posture === 'retreat' ? 0.95 : 0.75;
        command.thrust = Math.min(1, base * urgency);
        command.firePrimary = false;
        command.targetId = undefined;
      }
      break;
    case 'Escort':
      if (escortTarget) {
        if (escortAssignment) {
          const desired = TEMP_POS.copy(escortTarget.transform.position).add(escortAssignment.offset);
          heading.copy(desired).sub(ship.transform.position);
        } else {
          heading.copy(escortTarget.transform.position).sub(ship.transform.position);
        }
        if (heading.lengthSq() < 1e-5) {
          heading.set(0, 0, 1).applyQuaternion(ship.transform.rotation);
        } else {
          heading.normalize();
        }
      } else {
        heading.set(0, 0, 1).applyQuaternion(ship.transform.rotation);
      }
      command.thrust = 0.8;
      command.firePrimary = false;
      command.targetId = escortTarget?.id;
      break;
    case 'Kite':
      if (target) {
        heading.copy(ship.transform.position).sub(target.transform.position).normalize();
        distanceToTarget = ship.transform.position.distanceTo(target.transform.position);
      } else {
        heading.set(0, 0, 1).applyQuaternion(ship.transform.rotation);
      }
      command.thrust = 1;
      command.firePrimary = target != null;
      command.targetId = target?.id;
      break;
    case 'Flee':
      {
        const allyCentroid = state.blackboard.allyCentroid[ship.ship.team];
        heading.copy(allyCentroid).sub(ship.transform.position);
        if (heading.lengthSq() < 1e-5) {
          heading.set(0, 0, 1).applyQuaternion(ship.transform.rotation);
        } else {
          heading.normalize();
        }
        command.thrust = 1;
        command.firePrimary = false;
        command.targetId = undefined;
      }
      break;
    case 'Attack':
    default:
      if (target) {
        heading.copy(target.transform.position).sub(ship.transform.position).normalize();
        const dist = ship.transform.position.distanceTo(target.transform.position);
        const desiredMin = profile.desiredRange[0];
        const desiredMax = profile.desiredRange[1];
        distanceToTarget = dist;
        if (dist > desiredMax) {
          command.thrust = 1;
        } else if (dist < desiredMin) {
          heading.negate();
          command.thrust = 0.6;
        } else {
          command.thrust = 0.35;
        }
        command.firePrimary = dist <= ship.ship.range;
        command.targetId = target.id;
      } else {
        heading.set(0, 0, 1).applyQuaternion(ship.transform.rotation);
        command.thrust = 0;
        command.firePrimary = false;
        command.targetId = undefined;
      }
      break;
  }

  const stickinessActive =
    ai.stickinessUntil > state.ai.tickIndex &&
    ai.stickinessTargetId != null &&
    target != null &&
    ai.stickinessTargetId === target.id &&
    (ai.intent === 'Attack' || ai.intent === 'Intercept' || ai.intent === 'Reposition');

  if (stickinessActive && ai.stickinessHeading.lengthSq() > 1e-6) {
    heading.copy(ai.stickinessHeading);
  } else {
    applyVerticalPerturbation(state, ship, ai, profile, heading, target);
  }

  if (target && distanceToTarget != null) {
    updateBandStickiness(state, ai, target, distanceToTarget, profile.desiredRange, heading);
  }

  if (AI_CONFIG.verticalEnabled && Math.abs(heading.y) > 1e-6 && state.blackboard.verticalDispersion) {
    state.blackboard.verticalDispersion.headingYSamples.push(heading.y);
  }
}

function applyVerticalPerturbation(
  state: GameState,
  ship: ShipEntity,
  ai: AIState,
  profile: BehaviorProfile,
  heading: Vector3,
  target: ShipEntity | null,
): void {
  if (!AI_CONFIG.verticalEnabled) return;
  const amplitude = profile.verticalManeuver;
  if (amplitude <= 0) return;
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

export function recordFocusDiagnostics(
  state: GameState,
  ship: ShipEntity,
  target: ShipEntity | null,
  previousTargetId: EntityId | null,
): void {
  if (!target) return;
  const manager = state.ai;
  if (!manager) return;
  const teamCounts = state.blackboard.teamCounts;
  const teamCount = teamCounts ? teamCounts[ship.ship.team] ?? 0 : 0;
  if (teamCount <= 0) return;
  const focusFire = state.blackboard.focusFire;
  if (!focusFire) return;
  const focusMap = focusFire[ship.ship.team];
  if (!focusMap) return;
  const existing = focusMap.get(target.id) ?? 0;
  const includesSelf = previousTargetId != null && previousTargetId === target.id && existing > 0;
  const contribution = includesSelf ? existing : existing + 1;
  const ratio = Math.min(1, Math.max(0, contribution / teamCount));
  const metrics = manager.metrics;
  metrics.focusFireSamples += 1;
  metrics.focusFireRatioSum += ratio;
  if (ratio > metrics.focusFireRatioMax) {
    metrics.focusFireRatioMax = ratio;
  }
}

export function updateBandStickiness(
  state: GameState,
  ai: AIState,
  target: ShipEntity,
  distance: number,
  desiredRange: readonly [number, number],
  heading: Vector3,
): void {
  const [min, max] = desiredRange;
  const withinBand = distance >= min * 0.95 && distance <= max * 1.05;
  if (withinBand) {
    const tickInterval = Math.max(1e-4, state.ai.tickInterval);
    const durationTicks = Math.max(1, Math.round(AI_CONFIG.bandStickinessDuration / tickInterval));
    ai.stickinessUntil = state.ai.tickIndex + durationTicks;
    ai.stickinessTargetId = target.id;
    ai.stickinessHeading.copy(heading);
  } else if (distance > max * 1.2 || distance < min * 0.8) {
    ai.stickinessUntil = 0;
    ai.stickinessTargetId = undefined;
  }
}
