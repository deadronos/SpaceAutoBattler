import type { BehaviorProfile, ShipHull } from '../types/index.js';

export const AI_PROFILES: Record<string, BehaviorProfile> = {
  brawler: {
    desiredRange: [120, 220] as const,
    orbit: 0,
    aggression: 0.9,
    patience: 0.3,
    dodgeFreq: 0.2,
    classBias: {
      fighter: 20,
      corvette: 10,
      frigate: 5,
    },
    style: 'brawler',
    verticalManeuver: 0.25,
    elevationPreference: 'follow',
    bandPreference: 'mid',
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
    verticalManeuver: 0.15, // cruiser: 0.15 per issue spec (assuming kiter = cruiser-like)
    elevationPreference: 'follow',
    bandPreference: 'outer',
    gates: {
      hpRetreatPct: 0.35,
    },
  },
  escort: {
    desiredRange: [70, 180] as const,
    orbit: 60,
    aggression: 0.8,
    patience: 0.5,
    dodgeFreq: 0.3,
    classBias: {
      fighter: 15,
      corvette: 10,
    },
    style: 'escort',
    verticalManeuver: 0.5, // fighters: 0.5 per issue spec
    elevationPreference: 'follow',
    bandPreference: 'mid',
    gates: {
      hpRetreatPct: 0.3,
    },
  },
  artillery: {
    desiredRange: [260, 400] as const,
    orbit: 0,
    aggression: 0.6,
    patience: 0.7,
    dodgeFreq: 0.1,
    classBias: {
      carrier: 25,
      destroyer: 15,
    },
    style: 'artillery',
    verticalManeuver: 0.05, // artillery: 0.05 per issue spec
    elevationPreference: 'above',
    bandPreference: 'outer',
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
