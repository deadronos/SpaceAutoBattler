import type { GameState, ShipEntity } from '../../types/index.js';

/**
 * Finds the nearest enemy ship to a given origin ship.
 *
 * @param {GameState} state - The game state.
 * @param {ShipEntity} origin - The searching ship.
 * @returns {ShipEntity | null} The nearest enemy, or null if none found.
 */
export function findNearestEnemy(state: GameState, origin: ShipEntity): ShipEntity | null {
  const ships = state.queries.ships.entities as ShipEntity[];
  let closest: ShipEntity | null = null;
  let shortestSq = Number.POSITIVE_INFINITY;

  for (const ship of ships) {
    if (ship === origin) continue;
    if (ship.ship.team === origin.ship.team) continue;
    const distanceSq = origin.transform.position.distanceToSquared(ship.transform.position);
    if (distanceSq < shortestSq) {
      shortestSq = distanceSq;
      closest = ship;
    }
  }

  return closest;
}
