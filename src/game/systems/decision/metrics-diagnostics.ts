import { Vector3 } from 'three';
import type { AIState, GameState, ShipEntity, EntityId } from '../../../types/index.js';
import { AI_CONFIG } from '../../config.js';

/**
 * Records diagnostics about focus fire efficiency.
 *
 * @param {GameState} state - The game state.
 * @param {ShipEntity} ship - The ship firing/targeting.
 * @param {ShipEntity | null} target - The target ship.
 * @param {EntityId | null} previousTargetId - The previous target ID (to detect switching).
 */
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
  const teamCount = teamCounts ? (teamCounts[ship.ship.team] ?? 0) : 0;
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

/**
 * Updates "stickiness" state to prevent rapid target/maneuver switching when within the desired range band.
 *
 * @param {GameState} state - The game state.
 * @param {AIState} ai - The AI state.
 * @param {ShipEntity} target - The target.
 * @param {number} distance - Distance to target.
 * @param {readonly [number, number]} desiredRange - The desired range interval.
 * @param {Vector3} heading - The current heading command.
 */
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
    if (!ai.stickinessHeading) ai.stickinessHeading = new Vector3();
    ai.stickinessHeading.copy(heading);
  } else if (distance > max * 1.2 || distance < min * 0.8) {
    ai.stickinessUntil = 0;
    ai.stickinessTargetId = undefined;
  }
}
