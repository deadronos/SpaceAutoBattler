import type { ExplosionConfigEntry, ShipHull } from '../types/index.js';
import type { ExplosionFaction } from './explosions/common.js';
import { DEFAULT_EXPLOSION_CONFIG } from './explosions/common.js';
import { ALLIANCE_EXPLOSIONS } from './explosions/alliance.js';
import { REAVERS_EXPLOSIONS } from './explosions/reavers.js';

export type { ExplosionFaction } from './explosions/common.js';
export { DEFAULT_EXPLOSION_CONFIG } from './explosions/common.js';

/**
 * Global registry of explosion configurations, keyed by faction and hull.
 */
export const EXPLOSION_CONFIG: Record<ExplosionFaction, Record<ShipHull, ExplosionConfigEntry>> = {
  alliance: ALLIANCE_EXPLOSIONS,
  reavers: REAVERS_EXPLOSIONS,
};

/**
 * Retrieves the explosion configuration for a specific faction and hull.
 * Falls back to default config if not found.
 *
 * @param {ExplosionFaction} faction - The faction of the ship.
 * @param {ShipHull} hull - The hull type of the ship.
 * @returns {ExplosionConfigEntry} The resolved explosion configuration.
 */
export const getExplosionConfig = (
  faction: ExplosionFaction,
  hull: ShipHull,
): ExplosionConfigEntry => {
  const factionMap = EXPLOSION_CONFIG[faction];
  if (!factionMap) return DEFAULT_EXPLOSION_CONFIG;
  return factionMap[hull] ?? DEFAULT_EXPLOSION_CONFIG;
};
