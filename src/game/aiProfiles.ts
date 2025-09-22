import type { BehaviorProfile, ShipHull } from '../types/index.js';

export const AI_PROFILES: Record<string, BehaviorProfile> = {
  brawler: {
    desiredRange: [120, 220] as const,
    orbit: 0,
    aggression: 0.8,
    patience: 0.4,
    dodgeFreq: 0.2,
    classBias: {
      fighter: 20,
      corvette: 10,
      frigate: 5,
    },
    style: 'brawler',
    gates: {
      hpRetreatPct: 0.25,
    },
  },
  kiter: {
    desiredRange: [240, 360] as const,
    orbit: 160,
    aggression: 0.5,
    patience: 0.7,
    dodgeFreq: 0.6,
    classBias: {
      destroyer: 8,
      carrier: 12,
    },
    style: 'kiter',
    gates: {
      hpRetreatPct: 0.35,
    },
  },
  escort: {
    desiredRange: [90, 180] as const,
    orbit: 60,
    aggression: 0.6,
    patience: 0.8,
    dodgeFreq: 0.3,
    classBias: {
      fighter: 15,
      corvette: 10,
    },
    style: 'escort',
    gates: {
      hpRetreatPct: 0.3,
    },
  },
  artillery: {
    desiredRange: [360, 520] as const,
    orbit: 0,
    aggression: 0.4,
    patience: 0.9,
    dodgeFreq: 0.1,
    classBias: {
      carrier: 25,
      destroyer: 15,
    },
    style: 'artillery',
    gates: {
      hpRetreatPct: 0.4,
    },
  },
};

const PROFILE_BY_HULL: Record<ShipHull, string> = {
  fighter: 'escort',
  corvette: 'brawler',
  frigate: 'brawler',
  destroyer: 'artillery',
  carrier: 'artillery',
};

export function getDefaultProfileId(hull: ShipHull): string {
  return PROFILE_BY_HULL[hull] ?? 'brawler';
}

export function resolveBehaviorProfile(profileId: string): BehaviorProfile {
  const profile = AI_PROFILES[profileId];
  if (!profile) {
    return AI_PROFILES.brawler;
  }
  return profile;
}
