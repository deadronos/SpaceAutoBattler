import { describe, it, expect } from 'vitest';
import {
  scorePursue,
  scoreEvade,
  scoreRoam,
  chooseBestIntent,
} from '../../../src/core/ai/decisionEngine.js';
import { DEFAULT_BEHAVIOR_CONFIG } from '../../../src/config/behaviorConfig.js';

describe('decisionEngine scoring helpers', () => {
  const settings = DEFAULT_BEHAVIOR_CONFIG.globalSettings;
  const personality = { aggressiveness: 0.6, groupCohesion: 0.3 } as any;

  it('scorePursue increases with closer distance and aggressiveness', () => {
    const far = scorePursue({
      distanceToEnemy: 1000,
      preferredRange: 500,
      settings,
      personality,
      isScout: false,
      teamUnderAlarm: false,
    });
    const medium = scorePursue({
      distanceToEnemy: 300,
      preferredRange: 500,
      settings,
      personality,
      isScout: false,
      teamUnderAlarm: false,
    });
    const close = scorePursue({
      distanceToEnemy: 100,
      preferredRange: 500,
      settings,
      personality,
      isScout: false,
      teamUnderAlarm: false,
    });
    expect(medium).toBeGreaterThan(far);
    expect(close).toBeGreaterThan(medium);
  });

  it('scoreEvade spikes with damage and proximity', () => {
    const low = scoreEvade({
      distanceToThreat: 2000,
      recentDamage: 0,
      damageEvadeThreshold: 50,
      withinRecentDamageWindow: false,
      settings,
    });
    const withDamage = scoreEvade({
      distanceToThreat: 2000,
      recentDamage: 60,
      damageEvadeThreshold: 50,
      withinRecentDamageWindow: true,
      settings,
    });
    const proximityThreshold = settings.minimumSafeDistance * settings.closeRangeMultiplier;
    const closeThreat = scoreEvade({
      distanceToThreat: Math.max(0.1, proximityThreshold - 1),
      recentDamage: 0,
      damageEvadeThreshold: 50,
      withinRecentDamageWindow: false,
      settings,
    });
    expect(withDamage).toBeGreaterThan(low);
    expect(closeThreat).toBeGreaterThan(low);
  });

  it('scoreRoam prefers low cohesion and no friends nearby', () => {
    const noFriends = scoreRoam({ hasNearbyFriends: false, personality });
    const withFriends = scoreRoam({ hasNearbyFriends: true, personality });
    expect(noFriends).toBeGreaterThan(withFriends);
  });

  it('chooseBestIntent selects highest score', () => {
    const best = chooseBestIntent({ pursue: 0.2, evade: 0.9, patrol: 0.1 });
    expect(best).toBe('evade');
  });
});
