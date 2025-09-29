import { Vector3 } from 'three';
import type {
  AIState,
  BehaviorProfile,
  EscortAssignment,
  GameState,
  ShipEntity,
  EntityId,
} from '../../../types/index.js';
import { AI_CONFIG } from '../../config.js';
import { hashToInt } from './utils.js';
import {
  quantizeScore,
  getIntentPriority,
  tieBreak,
  computeInterceptHeadingVector,
  TEMP_REL_POS,
  TEMP_POS,
  TEMP_RNG,
  type IntentCandidate,
} from './intent-utils.js';
import { scoreAttackIntent, scoreKiteIntent, scoreFleeIntent } from './combat-intents.js';
import { scoreInterceptIntent, scoreRepositionIntent } from './tactical-intents.js';
import { scoreRegroupIntent, scoreEscortIntent } from './formation-intents.js';

export type { IntentCandidate } from './intent-utils.js';
export { quantizeScore, getIntentPriority, computeInterceptHeadingVector, tieBreak } from './intent-utils.js';
export { scoreAttackIntent, scoreKiteIntent, scoreFleeIntent } from './combat-intents.js';
export { scoreInterceptIntent, scoreRepositionIntent } from './tactical-intents.js';
export { scoreRegroupIntent, scoreEscortIntent } from './formation-intents.js';

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
