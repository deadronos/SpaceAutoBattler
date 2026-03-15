import type { GameState, ShipEntity } from '../../../types/index.js';
import { ensureAiEnabled } from './aiSafety.js';
import { executeShipAi } from './aiExecutor.js';
import { handleShipWeapons } from './weapons.js';
import { updateShipLifecycle } from './lifecycle.js';

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
    executeAICommand(state, ship, delta);
  }
}

/**
 * Executes the AI command for a single ship.
 * Handles weapon firing. Movement is handled by the motion system.
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

  handleShipWeapons(state, ship, decision, preferredTarget);

  return preferredTarget;
}
