import type { GameState, ShipEntity, BehaviorProfile } from '../../../types/index.js';
import { applyDoctrineToProfile } from '../../aiDoctrine.js';
import { adjustBehaviorProfileRange, isLegacyRangePolicy } from '../../utils/rangePolicy.js';

/**
 * Calculates the effective behavior profile for a ship, applying doctrine modifiers and dynamic adjustments.
 *
 * @param {GameState} state - The game state.
 * @param {ShipEntity} ship - The ship entity.
 * @param {BehaviorProfile} baseProfile - The base profile from static config.
 * @returns {BehaviorProfile} The effective profile.
 */
export function getEffectiveProfile(
  state: GameState,
  ship: ShipEntity,
  baseProfile: BehaviorProfile,
): BehaviorProfile {
  if (!isLegacyRangePolicy()) {
    return applyDoctrineToProfile(state, ship, baseProfile);
  }

  const desiredRange = adjustBehaviorProfileRange(
    baseProfile.desiredRange,
    baseProfile.style,
    ship.ship.hull,
  );

  if (desiredRange === baseProfile.desiredRange) {
    return applyDoctrineToProfile(state, ship, baseProfile);
  }

  const adjusted = {
    ...baseProfile,
    desiredRange,
  };
  return applyDoctrineToProfile(state, ship, adjusted);
}
