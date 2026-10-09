import type {
  AIState,
  BehaviorProfile,
  EscortAssignment,
  GameState,
  ShipEntity,
} from '../../../types/index.js';
import { AI_CONFIG, getEffectiveAIConfig } from '../../config.js';
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
import { computeVerticalClamp } from '../../utils/ai-vertical.js';
import { updateBandStickiness } from './metrics-diagnostics.js';
import { smoothHeading, smoothThrust } from './smoothing.js';

/**
 * Generates a specific command (heading, thrust, firing) based on the selected intent.
 * Writes the command to the AI state.
 *
 * @param {GameState} state - The game state.
 * @param {ShipEntity} ship - The AI ship.
 * @param {AIState} ai - The AI component state.
 * @param {BehaviorProfile} profile - The behavior profile.
 * @param {ShipEntity | null} target - The primary target.
 * @param {ShipEntity | null} escortTarget - The escort target.
 * @param {EscortAssignment | null} escortAssignment - Escort details.
 */
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
    smoothHeading(
      ai,
      heading,
      profile.patience,
      profile.aggression,
      ship.ship.hull,
      state.ai.tickIndex,
    );
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

  if (
    AI_CONFIG.verticalEnabled &&
    Math.abs(heading.y) > 1e-6 &&
    state.blackboard.verticalDispersion
  ) {
    state.blackboard.verticalDispersion.headingYSamples.push(heading.y);
  }
}
