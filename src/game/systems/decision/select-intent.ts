import type {
  AIState,
  BehaviorProfile,
  EscortAssignment,
  GameState,
  ShipEntity,
} from '../../../types/index.js';
import { AI_CONFIG } from '../../config.js';
import {
  quantizeScore,
  getIntentPriority,
  tieBreak,
  type IntentCandidate,
} from './intent-utils.js';
import { scoreAttackIntent, scoreKiteIntent, scoreFleeIntent } from './combat-intents.js';
import { scoreInterceptIntent, scoreRepositionIntent } from './tactical-intents.js';
import { scoreRegroupIntent, scoreEscortIntent } from './formation-intents.js';

/**
 * Selects the best high-level intent for an AI ship based on the current situation.
 * Evaluates candidates like Attack, Kite, Escort, Flee, etc.
 *
 * @param {GameState} state - The game state.
 * @param {ShipEntity} ship - The AI ship.
 * @param {AIState} ai - The AI component state.
 * @param {BehaviorProfile} profile - The behavior profile.
 * @param {ShipEntity | null} primaryTarget - The primary target entity.
 * @param {ShipEntity | null} escortTarget - The target to escort (if any).
 * @param {EscortAssignment | null} escortAssignment - Details of the escort mission.
 * @returns {IntentCandidate} The selected intent candidate.
 */
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
    const escortScore = scoreEscortIntent(
      ship,
      profile,
      escortTarget,
      state,
      traits,
      escortAssignment,
    );
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

    const repositionScore = scoreRepositionIntent(
      state,
      ship,
      profile,
      primaryTarget,
      traits,
      posture,
    );
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
    const rank = targetEntity
      ? (priorityLookup.get(targetEntity.id) ?? Number.POSITIVE_INFINITY)
      : Number.POSITIVE_INFINITY;
    candidate.threatRank = rank;
    candidate.index = candidateIndex;
    candidateIndex += 1;
  }

  return tieBreak(ai, state.ai.tickIndex, candidates, state.ai.metrics);
}
