import type {
  AIState,
  BehaviorProfile,
  EscortAssignment,
  GameState,
  ShipEntity,
} from '../../../types/index.js';
import { AI_CONFIG, getEffectiveAIConfig } from '../../config.js';
import {
  quantizeScore,
  getIntentPriority,
  tieBreak,
  type IntentCandidate,
} from './intent-utils.js';
import { scoreAttackIntent, scoreKiteIntent, scoreFleeIntent } from './combat-intents.js';
import { scoreInterceptIntent, scoreRepositionIntent } from './tactical-intents.js';
import { scoreRegroupIntent, scoreEscortIntent } from './formation-intents.js';
import {
  computeAttackCommand,
  computeInterceptCommand,
  computeRepositionCommand,
  computeRegroupCommand,
  computeEscortCommand,
  computeKiteCommand,
  computeFleeCommand,
  type CommandResult,
} from './command-generators.js';
import { applyVerticalPerturbation } from './vertical-maneuvers.js';
import { computeVerticalClamp } from './vertical-utils.js';
import { updateBandStickiness } from './metrics-diagnostics.js';
import { smoothHeading, smoothThrust } from './smoothing.js';

export type { IntentCandidate } from './intent-utils.js';
export type { CommandResult } from './command-generators.js';
export { quantizeScore, getIntentPriority, computeInterceptHeadingVector, tieBreak } from './intent-utils.js';
export { scoreAttackIntent, scoreKiteIntent, scoreFleeIntent } from './combat-intents.js';
export { scoreInterceptIntent, scoreRepositionIntent } from './tactical-intents.js';
export { scoreRegroupIntent, scoreEscortIntent } from './formation-intents.js';
export {
  computeAttackCommand,
  computeInterceptCommand,
  computeRepositionCommand,
  computeRegroupCommand,
  computeEscortCommand,
  computeKiteCommand,
  computeFleeCommand,
} from './command-generators.js';
export { applyVerticalPerturbation } from './vertical-maneuvers.js';
export { recordFocusDiagnostics, updateBandStickiness } from './metrics-diagnostics.js';

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

  let result: CommandResult;

  switch (ai.intent) {
    case 'Intercept':
      result = computeInterceptCommand(state, ship, profile, target, heading);
      break;
    case 'Reposition':
      result = computeRepositionCommand(state, ship, profile, target, heading);
      break;
    case 'Regroup':
      result = computeRegroupCommand(state, ship, profile, heading);
      break;
    case 'Escort':
      result = computeEscortCommand(state, ship, profile, escortTarget, escortAssignment, heading);
      break;
    case 'Kite':
      result = computeKiteCommand(state, ship, profile, target, heading);
      break;
    case 'Flee':
      result = computeFleeCommand(state, ship, profile, heading);
      break;
    case 'Attack':
    default:
      result = computeAttackCommand(state, ship, profile, target, heading);
      break;
  }

  // Assign raw thrust for now. Thrust smoothing is applied after heading
  // perturbation so that both heading and thrust smoothing states can be
  // initialized from the same observed command on the first frame.
  command.thrust = result.thrust;

  command.firePrimary = result.firePrimary;
  command.targetId = result.targetId;

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

  // Apply low-pass filtering for both thrust and heading to reduce spikes
  // and jitter. Thrust smoothing is done here after the vertical
  // perturbation so initialization uses the final perturbed heading.
  if (getEffectiveAIConfig().smoothingEnabled) {
    const smoothedThrust = smoothThrust(
      ai,
      result.thrust,
      profile.patience,
      profile.aggression,
      ship.ship.hull,
      state.ai.tickIndex,
    );
    command.thrust = smoothedThrust;
    smoothHeading(ai, heading, profile.patience, profile.aggression, ship.ship.hull, state.ai.tickIndex);
  }

  if (target && result.distanceToTarget != null) {
    updateBandStickiness(state, ai, target, result.distanceToTarget, profile.desiredRange, heading);
  }

  // Enforce vertical clamp on the final heading after smoothing. Use the
  // centralized computeVerticalClamp utility so logic is consistent with the
  // perturbation implementation.
  if (AI_CONFIG.verticalEnabled) {
    const clamp = computeVerticalClamp(state, ship, profile, ai, target);
    heading.y = Math.max(-clamp, Math.min(clamp, heading.y));
  }

  if (AI_CONFIG.verticalEnabled && Math.abs(heading.y) > 1e-6 && state.blackboard.verticalDispersion) {
    state.blackboard.verticalDispersion.headingYSamples.push(heading.y);
  }
}



