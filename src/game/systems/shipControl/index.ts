import type { GameState, ShipEntity } from '../../../types/index.js';
import { ensureAiEnabled } from './aiSafety.js';
import { executeShipAi } from './aiExecutor.js';
import { applyShipMovement } from './movementApply.js';
import { handleShipWeapons } from './weapons.js';
import { updateShipLifecycle } from './lifecycle.js';
import { runEmbeddedTurrets } from '../turrets.js';

export { getShipById } from './aiExecutor.js';

/**
 * Prepares ships for the update cycle.
 * Handles lifecycle updates (cooldowns, regen) and runs embedded turrets.
 *
 * @param {GameState} state - The game state.
 * @param {number} delta - The time step.
 */
export function prepareShips(state: GameState, delta: number): void {
  const ships = state.queries.ships.entities as ShipEntity[];

  if (state.ai && !state.ai.enabled) {
    ensureAiEnabled(state);
  }

  for (const ship of ships) {
    updateShipLifecycle(state, ship, delta);
    const preferredTarget = executeAICommand(state, ship, delta);

    if (state.queries.turrets.entities.length === 0 && ship.turrets && preferredTarget) {
      runEmbeddedTurrets(state, ship, preferredTarget);
    }
  }
}

/**
 * Executes the AI command for a single ship.
 * Applies movement and handles weapon firing.
 *
 * @param {GameState} state - The game state.
 * @param {ShipEntity} ship - The ship entity.
 * @param {number} delta - The time step.
 * @returns {ShipEntity | null} The ship's current target, or null.
 */
export function executeAICommand(
  state: GameState,
  ship: ShipEntity,
  delta: number,
): ShipEntity | null {
  const { decision, preferredTarget } = executeShipAi(state, ship, delta);
  if (!decision) {
    return preferredTarget;
  }

  applyShipMovement(state, ship, decision, delta);
  handleShipWeapons(state, ship, decision, preferredTarget);

  return preferredTarget;
}
