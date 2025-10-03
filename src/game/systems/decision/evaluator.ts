import type { GameState, ShipEntity, AIState, EntityId } from '../../../types/index.js';
import { AI_CONFIG } from '../../config.js';
import { resolveBehaviorProfile } from '../../aiProfiles.js';
import { generateTraitsFromSeed } from '../../aiTraits.js';
import { recordIntentMetrics } from '../../metrics.js';
import {
  selectIntent,
  computeLod,
  writeCommand,
  recordFocusDiagnostics,
} from './intents.js';
import { getEffectiveProfile } from './profile-adjustment.js';

export interface EvaluationResult {
  intent: AIState['intent'];
  lastScore: number;
  targetId: EntityId | undefined;
  desiredRange: readonly [number, number];
  lod: 0 | 1 | 2;
  nextThinkAt: number;
  shouldRecordFocusDiagnostics: boolean;
  finalTarget: ShipEntity | null;
  previousTargetId: EntityId | null;
}

export function evaluateShip(
  state: GameState,
  ship: ShipEntity,
  ai: AIState,
  entityById: Map<number, ShipEntity>,
): EvaluationResult {
  const baseProfile = resolveBehaviorProfile(ai.profileId);
  const profile = getEffectiveProfile(state, ship, baseProfile);
  if (!ai.traits) {
    ai.traits = generateTraitsFromSeed(ai.traitSeed);
  }
  const blackboard = state.blackboard;
  const nearestEnemyId = blackboard.nearestEnemy.get(ship.id);
  const fallbackTarget = nearestEnemyId != null ? entityById.get(nearestEnemyId) ?? null : null;
  const priorityList = blackboard.teamPriority[ship.ship.team];
  let priorityTarget: ShipEntity | null = null;
  if (priorityList.length > 0) {
    const candidate = entityById.get(priorityList[0].id) ?? null;
    if (candidate && candidate.ship.team !== ship.ship.team) {
      priorityTarget = candidate;
    }
  }
  const target = priorityTarget ?? fallbackTarget;
  const escortAssignment = state.ai.assignments.escorts.get(ship.id) ?? null;
  const escortTarget = escortAssignment ? entityById.get(escortAssignment.vipId) ?? null : null;

  const intent = selectIntent(state, ship, ai, profile, target, escortTarget, escortAssignment);
  const previousTargetId = ai.targetId ?? null;

  const lod = computeLod(ship, target, profile);
  const spacing = lod === 0 ? 1 : lod === 1 ? 2 : 4;
  const nextThinkAt = state.ai.tickIndex + spacing;

  const finalTarget = intent.target ?? target ?? fallbackTarget;
  const shouldRecordFocusDiagnostics = (intent.intent === 'Attack' || intent.intent === 'Intercept');

  return {
    intent: intent.intent,
    lastScore: intent.score,
    targetId: intent.target?.id ?? target?.id ?? fallbackTarget?.id,
    desiredRange: profile.desiredRange,
    lod,
    nextThinkAt,
    shouldRecordFocusDiagnostics,
    finalTarget,
    previousTargetId,
  };
}

export function applyEvaluationResult(
  state: GameState,
  ship: ShipEntity,
  ai: AIState,
  result: EvaluationResult,
  entityById: Map<number, ShipEntity>,
): void {
  // Apply AI state updates
  ai.intent = result.intent;
  ai.lastScore = result.lastScore;
  ai.targetId = result.targetId;
  ai.desiredRange = result.desiredRange;
  ai.lod = result.lod;
  ai.nextThinkAt = result.nextThinkAt;

  // Record intent metrics
  const isOpeningWindow = state.time <= AI_CONFIG.openingSalvoDuration;
  recordIntentMetrics(state.ai.metrics, state.ai.tickIndex, state.time, ai.intent, isOpeningWindow);

  // Generate command
  const baseProfile = resolveBehaviorProfile(ai.profileId);
  const profile = getEffectiveProfile(state, ship, baseProfile);
  const escortAssignment = state.ai.assignments.escorts.get(ship.id) ?? null;
  const escortTarget = escortAssignment ? entityById.get(escortAssignment.vipId) ?? null : null;
  const target = result.finalTarget;

  writeCommand(state, ship, ai, profile, target, escortTarget, escortAssignment);

  // Record focus diagnostics if needed
  if (result.shouldRecordFocusDiagnostics) {
    recordFocusDiagnostics(state, ship, result.finalTarget, result.previousTargetId);
  }
}