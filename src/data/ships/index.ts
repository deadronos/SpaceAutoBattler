import type { ShipHull, ShipStats } from '../../types/index.js';
import { validateMotionStats } from '../../game/validation.js';
import { FIGHTER_STATS } from './fighter.js';
import { CORVETTE_STATS } from './corvette.js';
import { FRIGATE_STATS } from './frigate.js';
import { DESTROYER_STATS } from './destroyer.js';
import { CARRIER_STATS } from './carrier.js';

// Map of all ship types to their stats
const SHIP_STATS_MAP: Record<ShipHull, ShipStats> = {
  fighter: FIGHTER_STATS,
  corvette: CORVETTE_STATS,
  frigate: FRIGATE_STATS,
  destroyer: DESTROYER_STATS,
  carrier: CARRIER_STATS,
};

// Validate all motion stats at module load time
Object.values(SHIP_STATS_MAP).forEach((stats) => validateMotionStats(stats.motion));

/**
 * Get the stats for a specific ship hull type.
 * @param hull - The ship hull type (e.g., 'fighter', 'corvette')
 * @returns The ShipStats for the given hull
 * @throws Error if the hull type is not found
 */
export function getShipStats(hull: ShipHull): ShipStats {
  const stats = SHIP_STATS_MAP[hull];
  if (!stats) {
    throw new Error(`Unknown ship hull type: ${hull}`);
  }
  return stats;
}

/**
 * List all available ship hull types.
 * @returns Array of all ShipHull types
 */
export function listShipTypes(): ShipHull[] {
  return Object.keys(SHIP_STATS_MAP) as ShipHull[];
}

/**
 * Check if a given hull type is valid.
 * @param hull - The ship hull type to check
 * @returns True if the hull type is valid, false otherwise
 */
export function isValidShipHull(hull: unknown): hull is ShipHull {
  return typeof hull === 'string' && hull in SHIP_STATS_MAP;
}

// Re-export the complete map for direct access (e.g., when iterating)
export const SHIP_STATS: Record<ShipHull, ShipStats> = SHIP_STATS_MAP;

// Re-export individual stats for convenience
export { FIGHTER_STATS } from './fighter.js';
export { CORVETTE_STATS } from './corvette.js';
export { FRIGATE_STATS } from './frigate.js';
export { DESTROYER_STATS } from './destroyer.js';
export { CARRIER_STATS } from './carrier.js';
