import { Vector3 } from 'three';
import type { AIState, ShipHull } from '../../../src/types/index.js';
import type { SeededRng } from '../../../src/utils/rng.js';
import { getDefaultProfileId } from '../../../src/game/aiProfiles.js';
import { generateTraitsFromSeed } from '../../../src/game/aiTraits.js';

/**
 * Creates AI-state defaults for harness ships.
 * Extracted to simplify ship creation logic.
 */
export function createHarnessAIState(
  hull: ShipHull,
  profileId: string | undefined,
  traitSeed: number | undefined,
  rng: SeededRng,
  tickInterval: number,
): AIState {
  const resolvedProfileId = profileId ?? getDefaultProfileId(hull);
  const resolvedTraitSeed = traitSeed ?? rng.int(1, 1_000_000);

  return {
    profileId: resolvedProfileId,
    intent: 'Attack',
    nextThinkAt: 0,
    cooldowns: { dodgeAt: 0, burstAt: 0 },
    lod: 0,
    traitSeed: resolvedTraitSeed,
    traits: generateTraitsFromSeed(resolvedTraitSeed),
    stickinessUntil: 0,
    stickinessHeading: new Vector3(0, 0, 1),
    targetId: undefined,
    lastScore: undefined,
    command: {
      heading: new Vector3(0, 0, 1),
      thrust: 0,
      firePrimary: false,
      ttl: tickInterval,
    },
  };
}
