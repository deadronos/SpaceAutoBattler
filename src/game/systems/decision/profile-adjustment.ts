import type { GameState, ShipEntity, BehaviorProfile } from '../../../types/index.js';
import { AI_CONFIG } from '../../config.js';

export function getEffectiveProfile(state: GameState, ship: ShipEntity, baseProfile: BehaviorProfile): BehaviorProfile {
  if (AI_CONFIG.rangePolicy !== 'v0.1.1-exp') return baseProfile;
  let [min, max] = baseProfile.desiredRange;
  switch (baseProfile.style) {
    case 'artillery':
      min += 30;
      max += 50;
      break;
    case 'brawler':
      min = Math.max(20, min - 20);
      max = Math.max(min + 40, max - 10);
      break;
    case 'escort':
      min = Math.max(15, min - 10);
      max = Math.max(min + 40, max);
      break;
    case 'kiter':
      min += 10;
      max += 30;
      break;
    default:
      break;
  }
  if (ship.ship.hull === 'carrier' || ship.ship.hull === 'destroyer') {
    min += 10;
    max += 30;
  }
  if (max - min < 40) {
    max = min + 40;
  }
  if (min < 10) min = 10;
  if (max <= min) max = min + 40;
  if (min === baseProfile.desiredRange[0] && max === baseProfile.desiredRange[1]) {
    return baseProfile;
  }
  return {
    ...baseProfile,
    desiredRange: [min, max] as const,
  };
}