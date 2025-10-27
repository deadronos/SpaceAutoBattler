import type { GameState, ShipEntity, BehaviorProfile } from '../../../types/index.js';
import { applyDoctrineToProfile } from '../../aiDoctrine.js';
import { adjustBehaviorProfileRange, isLegacyRangePolicy } from '../../utils/rangePolicy.js';

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
