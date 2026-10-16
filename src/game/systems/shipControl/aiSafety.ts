import type { GameState, ShipEntity } from '../../../types/index.js';
import {
  asKinematicBody,
  deferSetNextKinematicRotation,
  deferSetNextKinematicTranslation,
} from '../../physics/safeKinematics.js';
import { findNearestEnemy } from '../../utils/targetSelection.js';
import { ErrorCategory, reportRecoverableGameError } from '../../errors.js';

function getWarnings(state: GameState): NonNullable<GameState['simulation']['aiSafetyWarnings']> {
  return (state.simulation.aiSafetyWarnings ??= {
    aiForceEnable: false,
    missingAiShipIds: new Set<number>(),
  });
}

/**
 * Ensures that the AI system is enabled in the game state.
 * Logs a warning if it was disabled (legacy support removed).
 *
 * @param {GameState} state - The game state.
 */
export function ensureAiEnabled(state: GameState): void {
  if (state.ai) state.ai.enabled = true;
  const warnings = getWarnings(state);
  if (warnings.aiForceEnable) return;
  warnings.aiForceEnable = true;
  reportRecoverableGameError(
    ErrorCategory.Config,
    'AI v2 fallback removed: forcing AI enabled for all ships.',
    { source: 'aiSafety', code: 'ai-force-enable' },
  );
}

/**
 * Forces a ship to remain stationary.
 * Used as a fallback when AI is missing or invalid.
 *
 * @param {GameState} state - The game state.
 * @param {ShipEntity} ship - The ship entity.
 */
export function keepShipStationary(state: GameState, ship: ShipEntity): void {
  const position = ship.transform.position;
  deferSetNextKinematicTranslation(
    state,
    asKinematicBody(ship.rigidBody),
    position.x,
    position.y,
    position.z,
  );
  const rotation = ship.transform.rotation;
  deferSetNextKinematicRotation(
    state,
    asKinematicBody(ship.rigidBody),
    rotation.x,
    rotation.y,
    rotation.z,
    rotation.w,
  );
}

/**
 * Handles the case where a ship is missing its AI component.
 * Logs an error and keeps the ship stationary.
 *
 * @param {GameState} state - The game state.
 * @param {ShipEntity} ship - The ship entity.
 * @returns {ShipEntity | null} A fallback target (nearest enemy), or null.
 */
export function handleMissingAi(state: GameState, ship: ShipEntity): ShipEntity | null {
  const { missingAiShipIds } = getWarnings(state);
  if (!missingAiShipIds.has(ship.id)) {
    missingAiShipIds.add(ship.id);
    reportRecoverableGameError(
      ErrorCategory.Config,
      `Ship ${ship.id} is missing an AI component; keeping it stationary.`,
      { source: 'aiSafety', code: 'missing-ai-component', context: { shipId: ship.id } },
    );
  }
  keepShipStationary(state, ship);
  return findNearestEnemy(state, ship);
}
