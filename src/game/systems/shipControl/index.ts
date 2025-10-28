import type { GameState, ShipEntity } from '../../../types/index.js';
import { ensureAiEnabled } from './aiSafety.js';
import { executeShipAi } from './aiExecutor.js';
import { applyShipMovement } from './movementApply.js';
import { handleShipWeapons } from './weapons.js';
import { updateShipLifecycle } from './lifecycle.js';
import { runEmbeddedTurrets } from '../turrets.js';

export { getShipById } from './aiExecutor.js';

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
