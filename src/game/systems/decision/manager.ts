import type { GameState, ShipEntity, AIState, BehaviorProfile, EscortAssignment } from '../../../types/index.js';
import { AI_CONFIG } from '../../config.js';
import { aggregateKpis } from '../../metrics.js';
import {
  refreshBlackboard,
  assignTeamRoles,
} from './blackboard.js';
import {
  ensureInterruptState,
  getInterruptQueue,
  processInterruptQueue,
} from './interrupts.js';
import {
  processSchedulerTick,
  updateSchedulerMetrics,
  type SchedulerState,
  type SchedulerConfig,
} from './scheduler.js';
import {
  evaluateShip,
  applyEvaluationResult,
} from './evaluator.js';
import { getEffectiveProfile } from './profile-adjustment.js';

function runShipDecisions(
  state: GameState,
  ships: ShipEntity[],
  entityById: Map<number, ShipEntity>,
  shipIndicesToProcess: number[],
): { decisions: number; skipped: number } {
  let decisions = 0;
  let skipped = 0;

  for (const idx of shipIndicesToProcess) {
    const ship = ships[idx];
    const ai = ship.ai;
    if (!ai) {
      skipped += 1;
      continue;
    }
    if (ai.nextThinkAt > state.ai.tickIndex) {
      skipped += 1;
      continue;
    }
    
    const evaluationResult = evaluateShip(state, ship, ai, entityById);
    applyEvaluationResult(state, ship, ai, evaluationResult, entityById);
    decisions += 1;
  }

  return { decisions, skipped };
}

export function updateDecisionSystem(state: GameState, delta: number): void {
  if (!state.ai || !state.blackboard) return;
  const manager = state.ai;
  if (!manager.enabled) return;
  if (manager.tickInterval <= 0) return;

  ensureInterruptState(manager);
  getInterruptQueue(manager);
  if (!state.blackboard.teamCounts) {
    state.blackboard.teamCounts = { blue: 0, red: 0 };
  }

  const schedulerState: SchedulerState = {
    accumulator: manager.accumulator,
    tickIndex: manager.tickIndex,
    cursor: manager.cursor,
  };

  const schedulerConfig: SchedulerConfig = {
    tickInterval: manager.tickInterval,
    maxPerTick: manager.maxPerTick,
  };

  const ships = state.queries.ships.entities as ShipEntity[];
  const schedulerResult = processSchedulerTick(delta, schedulerState, schedulerConfig, ships.length);

  // Update manager state from scheduler result
  manager.accumulator = schedulerResult.updatedState.accumulator;
  manager.tickIndex = schedulerResult.updatedState.tickIndex;
  manager.cursor = schedulerResult.updatedState.cursor;

  if (!schedulerResult.tickOccurred) {
    return;
  }

  // Update blackboard tick index
  state.blackboard.tickIndex = manager.tickIndex;

  // Handle empty ship list
  if (ships.length === 0) {
    manager.assignments.escorts.clear();
    state.blackboard.nearestEnemy.clear();
    state.blackboard.threatToVip.clear();
    if (state.blackboard.teamCounts) {
      state.blackboard.teamCounts.blue = 0;
      state.blackboard.teamCounts.red = 0;
    }
    updateSchedulerMetrics(manager.metrics, schedulerResult.metrics, 0, 0, 1);
    aggregateKpis(manager.metrics, manager.tickIndex);
    return;
  }

  const entityById = new Map<number, ShipEntity>();
  for (const ship of ships) entityById.set(ship.id, ship);

  refreshBlackboard(state, ships);
  assignTeamRoles(state, ships);
  processInterruptQueue(manager, entityById);

  const { decisions, skipped } = runShipDecisions(state, ships, entityById, schedulerResult.shipIndicesToProcess);

  // Compute slices for metrics (this matches the original logic)
  const slices = Math.max(1, Math.ceil(ships.length / Math.max(1, manager.maxPerTick)));
  manager.slices = slices;

  updateSchedulerMetrics(manager.metrics, schedulerResult.metrics, decisions, skipped, slices);
  aggregateKpis(manager.metrics, manager.tickIndex);
}

export function runDecisionTick(state: GameState, delta: number): void {
  updateDecisionSystem(state, delta);
}

export const __decisionInternals = {
  getEffectiveProfile,
  runShipDecisions,
  evaluateShip: (state: GameState, ship: ShipEntity, ai: AIState, entityById: Map<number, ShipEntity>) => {
    const evaluationResult = evaluateShip(state, ship, ai, entityById);
    applyEvaluationResult(state, ship, ai, evaluationResult, entityById);
  },
};