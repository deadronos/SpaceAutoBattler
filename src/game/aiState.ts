import { Vector3 } from 'three';
import type { AIState, GameState, ShipHull } from '../types/index.js';
import { getDefaultProfileId } from './aiProfiles.js';
import { generateTraitsFromSeed } from './aiTraits.js';

/**
 * Create initial AI state for a ship using deterministic trait generation.
 */
export function createInitialAIState(state: GameState, hull: ShipHull): AIState {
  const profileId = getDefaultProfileId(hull);
  const heading = new Vector3(0, 0, 1);
  const tickInterval = state.ai.tickInterval || 0.1;
  const traitSeed = Math.max(1, Math.floor(state.rng.next() * 0x7fffffff));
  return {
    profileId,
    intent: 'Attack',
    nextThinkAt: 0,
    cooldowns: {
      dodgeAt: 0,
      burstAt: 0,
    },
    lod: 1,
    traitSeed,
    traits: generateTraitsFromSeed(traitSeed),
    stickinessUntil: 0,
    stickinessHeading: new Vector3(0, 0, 1),
    command: {
      heading,
      thrust: 0,
      firePrimary: false,
      ttl: tickInterval,
    },
  };
}
