import type { GameState, ShipEntity } from '../../../types/index.js';
import type { KinematicBody } from '../../physics/safeKinematics.js';
import {
  deferSetNextKinematicRotation,
  deferSetNextKinematicTranslation,
} from '../../physics/safeKinematics.js';
import { findNearestEnemy } from '../../utils/targetSelection.js';

const missingAiShips = new Set<number>();
let warnedAiDisableInShips = false;

/**
 * Ensures that the AI system is enabled in the game state.
 * Logs a warning if it was disabled (legacy support removed).
 *
 * @param {GameState} state - The game state.
 */
export function ensureAiEnabled(state: GameState): void {
  if (state.ai) state.ai.enabled = true;
  if (warnedAiDisableInShips) return;
  warnedAiDisableInShips = true;
  try {
    globalThis.console?.warn?.('AI v2 fallback removed: forcing AI enabled for all ships.');
  } catch {
    // ignore logging failures in headless tests
  }
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
    ship.rigidBody as unknown as KinematicBody,
    position.x,
    position.y,
    position.z,
  );
  const rotation = ship.transform.rotation;
  deferSetNextKinematicRotation(
    state,
    ship.rigidBody as unknown as KinematicBody,
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
  if (!missingAiShips.has(ship.id)) {
    missingAiShips.add(ship.id);
    try {
      globalThis.console?.error?.(
        `Ship ${ship.id} is missing an AI component; keeping it stationary.`,
      );
    } catch {
      // ignore logging failures
    }
  }
  keepShipStationary(state, ship);
  return findNearestEnemy(state, ship);
}
