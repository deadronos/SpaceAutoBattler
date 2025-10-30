import type { ExplosionConfigEntry, ShipHull } from '../types/index.js';
import type { ExplosionFaction } from './explosions/common.js';
import { DEFAULT_EXPLOSION_CONFIG } from './explosions/common.js';
import { ALLIANCE_EXPLOSIONS } from './explosions/alliance.js';
import { REAVERS_EXPLOSIONS } from './explosions/reavers.js';

export type { ExplosionFaction } from './explosions/common.js';
export { DEFAULT_EXPLOSION_CONFIG } from './explosions/common.js';

export const EXPLOSION_CONFIG: Record<ExplosionFaction, Record<ShipHull, ExplosionConfigEntry>> = {
  alliance: ALLIANCE_EXPLOSIONS,
  reavers: REAVERS_EXPLOSIONS,
};

export const getExplosionConfig = (
  faction: ExplosionFaction,
  hull: ShipHull,
): ExplosionConfigEntry => {
  const factionMap = EXPLOSION_CONFIG[faction];
  if (!factionMap) return DEFAULT_EXPLOSION_CONFIG;
  return factionMap[hull] ?? DEFAULT_EXPLOSION_CONFIG;
};
