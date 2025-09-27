import type { ExplosionConfigEntry, ShipHull } from '../types/index.js';

export type ExplosionFaction = 'alliance' | 'ravers';

const DEFAULT_PARTICLE_COUNTS = { sparks: 10, plasma: 6, smoke: 8 } as const;

// Default timing values that were previously hardcoded
const DEFAULT_TIMING = {
  duration: 1.8,
  lightDuration: 0.25,
  shockwave: { delay: 0.08, duration: 0.32 },
  fireball: { delay: 0.2, duration: 0.4 },
  debrisSpeed: [12, 26] as [number, number],
} as const;

const ALLIANCE_BASE: Record<ShipHull, ExplosionConfigEntry> = {
  fighter: {
    baseRadius: 3,
    flashIntensity: 1.1,
    lightColor: '#a6d8ff',
    lightFalloff: 40,
    debrisCount: 6,
    particleCounts: { ...DEFAULT_PARTICLE_COUNTS, sparks: 12 },
    palette: {
      flash: '#a6d8ff',
      shockwave: '#9fc9ff',
      fireballHot: '#f0fbff',
      smoke: '#6b7b92',
    },
    timing: {
      duration: 1.5, // Faster for small ships
      lightDuration: 0.2,
      shockwave: { delay: 0.06, duration: 0.28 },
      fireball: { delay: 0.18, duration: 0.35 },
      debrisSpeed: [10, 22] as [number, number],
    },
  },
  corvette: {
    baseRadius: 3.6,
    flashIntensity: 1.15,
    lightColor: '#a6d8ff',
    lightFalloff: 55,
    debrisCount: 8,
    particleCounts: { ...DEFAULT_PARTICLE_COUNTS, sparks: 14, plasma: 8 },
    palette: {
      flash: '#a6d8ff',
      shockwave: '#8fb6ff',
      fireballHot: '#e4f6ff',
      smoke: '#65728d',
    },
    timing: {
      duration: 1.65,
      lightDuration: 0.22,
      shockwave: { delay: 0.07, duration: 0.3 },
      fireball: { delay: 0.19, duration: 0.38 },
      debrisSpeed: [11, 24] as [number, number],
    },
  },
  frigate: {
    baseRadius: 4.4,
    flashIntensity: 1.2,
    lightColor: '#a6d8ff',
    lightFalloff: 65,
    debrisCount: 10,
    particleCounts: { sparks: 16, plasma: 10, smoke: 12 },
    palette: {
      flash: '#a6d8ff',
      shockwave: '#85acff',
      fireballHot: '#d7ecff',
      smoke: '#5f6c87',
    },
    timing: { ...DEFAULT_TIMING }, // Standard timing for medium ships
  },
  destroyer: {
    baseRadius: 5.4,
    flashIntensity: 1.25,
    lightColor: '#a6d8ff',
    lightFalloff: 75,
    debrisCount: 12,
    particleCounts: { sparks: 18, plasma: 12, smoke: 14 },
    palette: {
      flash: '#a6d8ff',
      shockwave: '#7ca3ff',
      fireballHot: '#cbe1ff',
      smoke: '#59647f',
    },
    timing: {
      duration: 2.0, // Longer for larger ships
      lightDuration: 0.28,
      shockwave: { delay: 0.09, duration: 0.36 },
      fireball: { delay: 0.22, duration: 0.45 },
      debrisSpeed: [13, 28] as [number, number],
    },
  },
  carrier: {
    baseRadius: 7,
    flashIntensity: 1.3,
    lightColor: '#a6d8ff',
    lightFalloff: 90,
    debrisCount: 16,
    particleCounts: { sparks: 20, plasma: 14, smoke: 18 },
    palette: {
      flash: '#a6d8ff',
      shockwave: '#7298ff',
      fireballHot: '#bed4ff',
      smoke: '#525c77',
    },
    timing: {
      duration: 2.2, // Longest for massive ships
      lightDuration: 0.32,
      shockwave: { delay: 0.1, duration: 0.4 },
      fireball: { delay: 0.25, duration: 0.5 },
      debrisSpeed: [15, 32] as [number, number],
    },
  },
};

const RAVERS_BASE: Record<ShipHull, ExplosionConfigEntry> = {
  fighter: {
    baseRadius: 3.2,
    flashIntensity: 1.2,
    lightColor: '#ff8447',
    lightFalloff: 40,
    debrisCount: 7,
    particleCounts: { sparks: 14, plasma: 6, smoke: 9 },
    palette: {
      flash: '#ffb347',
      shockwave: '#ff7847',
      fireballHot: '#ff6138',
      smoke: '#5a3122',
    },
    timing: {
      duration: 1.6, // Slightly longer than Alliance fighters (more aggressive)
      lightDuration: 0.22,
      shockwave: { delay: 0.06, duration: 0.3 },
      fireball: { delay: 0.17, duration: 0.38 },
      debrisSpeed: [12, 25] as [number, number],
    },
  },
  corvette: {
    baseRadius: 3.9,
    flashIntensity: 1.25,
    lightColor: '#ff8447',
    lightFalloff: 55,
    debrisCount: 9,
    particleCounts: { sparks: 16, plasma: 8, smoke: 11 },
    palette: {
      flash: '#ffb347',
      shockwave: '#ff6a36',
      fireballHot: '#ff4c24',
      smoke: '#53291c',
    },
    timing: {
      duration: 1.75,
      lightDuration: 0.25,
      shockwave: { delay: 0.07, duration: 0.32 },
      fireball: { delay: 0.18, duration: 0.4 },
      debrisSpeed: [13, 26] as [number, number],
    },
  },
  frigate: {
    baseRadius: 4.8,
    flashIntensity: 1.32,
    lightColor: '#ff8447',
    lightFalloff: 65,
    debrisCount: 12,
    particleCounts: { sparks: 18, plasma: 10, smoke: 14 },
    palette: {
      flash: '#ffb347',
      shockwave: '#ff612c',
      fireballHot: '#ff3d18',
      smoke: '#4a2216',
    },
    timing: {
      duration: 1.9, // Slightly longer than Alliance
      lightDuration: 0.27,
      shockwave: { delay: 0.08, duration: 0.34 },
      fireball: { delay: 0.19, duration: 0.42 },
      debrisSpeed: [14, 28] as [number, number],
    },
  },
  destroyer: {
    baseRadius: 5.8,
    flashIntensity: 1.38,
    lightColor: '#ff8447',
    lightFalloff: 80,
    debrisCount: 15,
    particleCounts: { sparks: 22, plasma: 12, smoke: 16 },
    palette: {
      flash: '#ffb347',
      shockwave: '#ff531d',
      fireballHot: '#ff2f0e',
      smoke: '#421b11',
    },
    timing: {
      duration: 2.1,
      lightDuration: 0.3,
      shockwave: { delay: 0.09, duration: 0.38 },
      fireball: { delay: 0.21, duration: 0.48 },
      debrisSpeed: [15, 30] as [number, number],
    },
  },
  carrier: {
    baseRadius: 7.6,
    flashIntensity: 1.45,
    lightColor: '#ff8447',
    lightFalloff: 95,
    debrisCount: 20,
    particleCounts: { sparks: 26, plasma: 16, smoke: 20 },
    palette: {
      flash: '#ffb347',
      shockwave: '#ff4512',
      fireballHot: '#ff2405',
      smoke: '#38150c',
    },
    timing: {
      duration: 2.4, // Longest and most dramatic
      lightDuration: 0.35,
      shockwave: { delay: 0.1, duration: 0.42 },
      fireball: { delay: 0.23, duration: 0.55 },
      debrisSpeed: [16, 35] as [number, number],
    },
  },
};

export const EXPLOSION_CONFIG: Record<ExplosionFaction, Record<ShipHull, ExplosionConfigEntry>> = {
  alliance: ALLIANCE_BASE,
  ravers: RAVERS_BASE,
};

export const DEFAULT_EXPLOSION_CONFIG: ExplosionConfigEntry = {
  baseRadius: 3.5,
  flashIntensity: 1.2,
  lightColor: '#ffb347',
  lightFalloff: 60,
  debrisCount: 8,
  particleCounts: { sparks: 14, plasma: 8, smoke: 10 },
  palette: {
    flash: '#ffb347',
    shockwave: '#ff7847',
    fireballHot: '#ff6138',
    smoke: '#4a281c',
  },
  timing: { ...DEFAULT_TIMING },
};

export function getExplosionConfig(faction: ExplosionFaction, hull: ShipHull): ExplosionConfigEntry {
  const factionMap = EXPLOSION_CONFIG[faction];
  if (!factionMap) return DEFAULT_EXPLOSION_CONFIG;
  return factionMap[hull] ?? DEFAULT_EXPLOSION_CONFIG;
}
