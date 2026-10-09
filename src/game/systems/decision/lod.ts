import type { BehaviorProfile, ShipEntity } from '../../../types/index.js';
import { AI_CONFIG } from '../../config.js';
import { getDistanceBetween } from './intent-utils.js';

/**
 * Computes the Level of Detail (LOD) for AI processing based on distance to target.
 *
 * @param {ShipEntity} ship - The AI ship.
 * @param {ShipEntity | null} target - The target ship.
 * @param {BehaviorProfile} profile - The behavior profile.
 * @returns {0 | 1 | 2} The LOD level (0=high, 2=low).
 */
export function computeLod(
  ship: ShipEntity,
  target: ShipEntity | null,
  profile: BehaviorProfile,
): 0 | 1 | 2 {
  if (!target) return 2;
  if (ship.ship.hull === 'carrier' || ship.ship.hull === 'destroyer') return 0;
  const dist = getDistanceBetween(ship, target);
  const active = Math.max(profile.desiredRange[1], AI_CONFIG.lod.activeDistance);
  if (dist <= active) return 0;
  if (dist <= AI_CONFIG.lod.idleDistance) return 1;
  return 2;
}
