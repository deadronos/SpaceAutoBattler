import type { GameState, ShipEntity, AIState, EntityId } from '../../../types/index.js';
import { AI_CONFIG } from '../../config.js';
import { resolveBehaviorProfile } from '../../aiProfiles.js';
import { generateTraitsFromSeed } from '../../aiTraits.js';
import { recordIntentMetrics } from '../../metrics.js';
import { selectIntent, computeLod, writeCommand, recordFocusDiagnostics } from './intents.js';
import { getEffectiveProfile } from './profile-adjustment.js';

/**
 * Result of the ship evaluation process.
 */
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

/**
 * Evaluates a ship's situation and determines the best next action (intent).
 * Does NOT apply the changes to the ship's state; this is a pure function.
 *
 * @param {GameState} state - The game state.
 * @param {ShipEntity} ship - The ship to evaluate.
 * @param {AIState} ai - The AI state of the ship.
 * @param {Map<number, ShipEntity>} entityById - Lookup map for entities.
 * @returns {EvaluationResult} The result of the evaluation.
 */
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
  const fallbackTarget = nearestEnemyId != null ? (entityById.get(nearestEnemyId) ?? null) : null;
  const priorityList = blackboard.teamPriority[ship.ship.team];
  let priorityTarget: ShipEntity | null = null;
  const firstPriority = priorityList[0];
  if (firstPriority) {
    const candidate = entityById.get(firstPriority.id) ?? null;
    if (candidate && candidate.ship.team !== ship.ship.team) {
      priorityTarget = candidate;
    }
  }
  const target = priorityTarget ?? fallbackTarget;
  const escortAssignment = state.ai.assignments.escorts.get(ship.id) ?? null;
  const escortTarget = escortAssignment ? (entityById.get(escortAssignment.vipId) ?? null) : null;

  const intent = selectIntent(state, ship, ai, profile, target, escortTarget, escortAssignment);
  const previousTargetId = ai.targetId ?? null;

  const lod = computeLod(ship, target, profile);
  const spacing = lod === 0 ? 1 : lod === 1 ? 2 : 4;
  const nextThinkAt = state.ai.tickIndex + spacing;

  const finalTarget = intent.target ?? target ?? fallbackTarget;
  const shouldRecordFocusDiagnostics = intent.intent === 'Attack' || intent.intent === 'Intercept';

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

/**
 * Applies the evaluation result to the ship's AI state and generates the final command.
 *
 * @param {GameState} state - The game state.
 * @param {ShipEntity} ship - The ship entity.
 * @param {AIState} ai - The AI state to update.
 * @param {EvaluationResult} result - The result from evaluateShip.
 * @param {Map<number, ShipEntity>} entityById - Lookup map.
 */
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
  const escortTarget = escortAssignment ? (entityById.get(escortAssignment.vipId) ?? null) : null;
  const target = result.finalTarget;

  writeCommand(state, ship, ai, profile, target, escortTarget, escortAssignment);

  // Record focus diagnostics if needed
  if (result.shouldRecordFocusDiagnostics) {
    recordFocusDiagnostics(state, ship, result.finalTarget, result.previousTargetId);
  }
}
