import type { GameState, ShipEntity, AIState, BehaviorProfile, EscortAssignment } from '../../../types/index.js';
import { AI_CONFIG } from '../../config.js';
import { resolveBehaviorProfile } from '../../aiProfiles.js';
import { generateTraitsFromSeed } from '../../aiTraits.js';
import { aggregateKpis, recordIntentMetrics } from '../../metrics.js';
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
  selectIntent,
  computeLod,
  writeCommand,
  recordFocusDiagnostics,
} from './intents.js';

function getEffectiveProfile(state: GameState, ship: ShipEntity, baseProfile: BehaviorProfile): BehaviorProfile {
  if (AI_CONFIG.rangePolicy !== 'v0.1.1-exp') return baseProfile;
  let [min, max] = baseProfile.desiredRange;
  switch (baseProfile.style) {
    case 'artillery':
      min += 30;
      max += 50;
      break;
    case 'brawler':
      min = Math.max(20, min - 20);
      max = Math.max(min + 40, max - 10);
      break;
    case 'escort':
      min = Math.max(15, min - 10);
      max = Math.max(min + 40, max);
      break;
    case 'kiter':
      min += 10;
      max += 30;
      break;
    default:
      break;
  }
  if (ship.ship.hull === 'carrier' || ship.ship.hull === 'destroyer') {
    min += 10;
    max += 30;
  }
  if (max - min < 40) {
    max = min + 40;
  }
  if (min < 10) min = 10;
  if (max <= min) max = min + 40;
  if (min === baseProfile.desiredRange[0] && max === baseProfile.desiredRange[1]) {
    return baseProfile;
  }
  return {
    ...baseProfile,
    desiredRange: [min, max] as const,
  };
}

function runShipDecisions(
  state: GameState,
  ships: ShipEntity[],
  entityById: Map<number, ShipEntity>,
): void {
  const manager = state.ai;
  const metrics = manager.metrics;
  const total = ships.length;
  if (total === 0) {
    metrics.lastTotalShips = 0;
    metrics.lastSliceSize = 0;
    metrics.lastDecisions = 0;
    metrics.lastSkipped = 0;
    aggregateKpis(metrics, manager.tickIndex);
    return;
  }

  const slices = Math.max(1, Math.ceil(total / Math.max(1, manager.maxPerTick)));
  manager.slices = slices;
  const sliceSize = Math.min(manager.maxPerTick, Math.ceil(total / slices));
  const startIndex = manager.cursor % total;

  metrics.lastTotalShips = total;
  metrics.lastSliceSize = sliceSize;

  let decisions = 0;
  let skipped = 0;

  for (let i = 0; i < sliceSize; i += 1) {
    const idx = (startIndex + i) % total;
    const ship = ships[idx];
    const ai = ship.ai;
    if (!ai) continue;
    if (ai.nextThinkAt > manager.tickIndex) {
      skipped += 1;
      continue;
    }
    evaluateShip(state, ship, ai, entityById);
    decisions += 1;
  }

  manager.cursor = (startIndex + sliceSize) % total;

  metrics.lastDecisions = decisions;
  metrics.lastSkipped = skipped;
  metrics.totalDecisions += decisions;
  metrics.totalSkipped += skipped;
  if (sliceSize < total) {
    metrics.budgetHits += 1;
  }

  aggregateKpis(metrics, manager.tickIndex);
}

function evaluateShip(
  state: GameState,
  ship: ShipEntity,
  ai: AIState,
  entityById: Map<number, ShipEntity>,
): void {
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
  ai.intent = intent.intent;
  ai.lastScore = intent.score;
  ai.targetId = intent.target?.id ?? target?.id ?? fallbackTarget?.id;
  ai.desiredRange = profile.desiredRange;

  const isOpeningWindow = state.time <= AI_CONFIG.openingSalvoDuration;
  recordIntentMetrics(state.ai.metrics, state.ai.tickIndex, state.time, ai.intent, isOpeningWindow);

  const lod = computeLod(ship, target, profile);
  ai.lod = lod;
  const spacing = lod === 0 ? 1 : lod === 1 ? 2 : 4;
  ai.nextThinkAt = state.ai.tickIndex + spacing;

  writeCommand(state, ship, ai, profile, intent.target ?? target, escortTarget, escortAssignment);

  if (ai.intent === 'Attack' || ai.intent === 'Intercept') {
    const finalTarget = intent.target ?? target ?? fallbackTarget;
    recordFocusDiagnostics(state, ship, finalTarget, previousTargetId);
  }
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

  manager.accumulator += delta;

  while (manager.accumulator >= manager.tickInterval) {
    manager.accumulator -= manager.tickInterval;
    manager.tickIndex += 1;
    state.blackboard.tickIndex = manager.tickIndex;

    const ships = state.queries.ships.entities as ShipEntity[];
    if (ships.length === 0) {
      manager.cursor = 0;
      manager.assignments.escorts.clear();
      state.blackboard.nearestEnemy.clear();
      state.blackboard.threatToVip.clear();
      if (state.blackboard.teamCounts) {
        state.blackboard.teamCounts.blue = 0;
        state.blackboard.teamCounts.red = 0;
      }
      const metrics = manager.metrics;
      metrics.lastDecisions = 0;
      metrics.lastSkipped = 0;
      metrics.lastSliceSize = 0;
      metrics.lastTotalShips = 0;
      continue;
    }

    const entityById = new Map<number, ShipEntity>();
    for (const ship of ships) entityById.set(ship.id, ship);

    refreshBlackboard(state, ships);
    assignTeamRoles(state, ships);
    processInterruptQueue(manager, entityById);
    runShipDecisions(state, ships, entityById);
  }
}

export function runDecisionTick(state: GameState, delta: number): void {
  updateDecisionSystem(state, delta);
}

export const __decisionInternals = {
  getEffectiveProfile,
  runShipDecisions,
  evaluateShip,
};
