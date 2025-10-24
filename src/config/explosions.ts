import type { ExplosionConfigEntry, ShipHull } from '../types/index.js';

export type ExplosionFaction = 'alliance' | 'reavers';

const DEFAULT_PARTICLE_COUNTS = { sparks: 10, plasma: 6, smoke: 8 } as const;

// Default timing values that were previously hardcoded
const DEFAULT_TIMING = {
  duration: 1.8,
  lightDuration: 0.25,
  shockwave: { delay: 0.08, duration: 0.32 },
  fireball: { delay: 0.2, duration: 0.4 },
  debrisSpeed: [12, 26] as [number, number],
} as const;

// Scale factor applied to visual-size-related explosion parameters when tuning "bigger" explosions.
// Changing this single constant allows consistent per-hull scaling (base radius, debris counts, particle counts, and debris speed ranges).
const EXPLOSION_SCALE = 2; // ~2x bigger per hull as requested

const DEFAULT_SHOCKWAVE_MULTI = 5.0; // Backwards-compatible default multiplier

const ALLIANCE_BASE: Record<ShipHull, ExplosionConfigEntry> = {
  fighter: {
    baseRadius: 3 * EXPLOSION_SCALE,
    flashIntensity: 1.1,
    lightColor: '#a6d8ff',
    lightFalloff: 40,
    debrisCount: 6 * EXPLOSION_SCALE,
    particleCounts: { ...DEFAULT_PARTICLE_COUNTS, sparks: 12 * EXPLOSION_SCALE },
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
      debrisSpeed: [10 * EXPLOSION_SCALE, 22 * EXPLOSION_SCALE] as [number, number],
    },
    shockwaveMaxRadiusMulti: DEFAULT_SHOCKWAVE_MULTI,
  },
  corvette: {
    baseRadius: 3.6 * EXPLOSION_SCALE,
    flashIntensity: 1.15,
    lightColor: '#a6d8ff',
    lightFalloff: 55,
    debrisCount: 8 * EXPLOSION_SCALE,
    particleCounts: {
      ...DEFAULT_PARTICLE_COUNTS,
      sparks: 14 * EXPLOSION_SCALE,
      plasma: 8 * EXPLOSION_SCALE,
    },
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
      debrisSpeed: [11 * EXPLOSION_SCALE, 24 * EXPLOSION_SCALE] as [number, number],
    },
    shockwaveMaxRadiusMulti: DEFAULT_SHOCKWAVE_MULTI,
  },
  frigate: {
    baseRadius: 4.4 * EXPLOSION_SCALE,
    flashIntensity: 1.2,
    lightColor: '#a6d8ff',
    lightFalloff: 65,
    debrisCount: 10 * EXPLOSION_SCALE,
    particleCounts: {
      sparks: 16 * EXPLOSION_SCALE,
      plasma: 10 * EXPLOSION_SCALE,
      smoke: 12 * EXPLOSION_SCALE,
    },
    palette: {
      flash: '#a6d8ff',
      shockwave: '#85acff',
      fireballHot: '#d7ecff',
      smoke: '#5f6c87',
    },
    timing: {
      ...DEFAULT_TIMING,
      debrisSpeed: [
        DEFAULT_TIMING.debrisSpeed[0] * EXPLOSION_SCALE,
        DEFAULT_TIMING.debrisSpeed[1] * EXPLOSION_SCALE,
      ],
    }, // Standard timing for medium ships
    shockwaveMaxRadiusMulti: DEFAULT_SHOCKWAVE_MULTI,
  },
  destroyer: {
    baseRadius: 5.4 * EXPLOSION_SCALE,
    flashIntensity: 1.25,
    lightColor: '#a6d8ff',
    lightFalloff: 75,
    debrisCount: 12 * EXPLOSION_SCALE,
    particleCounts: {
      sparks: 18 * EXPLOSION_SCALE,
      plasma: 12 * EXPLOSION_SCALE,
      smoke: 14 * EXPLOSION_SCALE,
    },
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
      debrisSpeed: [13 * EXPLOSION_SCALE, 28 * EXPLOSION_SCALE] as [number, number],
    },
    shockwaveMaxRadiusMulti: DEFAULT_SHOCKWAVE_MULTI,
  },
  carrier: {
    baseRadius: 7 * EXPLOSION_SCALE,
    flashIntensity: 1.3,
    lightColor: '#a6d8ff',
    lightFalloff: 90,
    debrisCount: 16 * EXPLOSION_SCALE,
    particleCounts: {
      sparks: 20 * EXPLOSION_SCALE,
      plasma: 14 * EXPLOSION_SCALE,
      smoke: 18 * EXPLOSION_SCALE,
    },
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
      debrisSpeed: [15 * EXPLOSION_SCALE, 32 * EXPLOSION_SCALE] as [number, number],
    },
    shockwaveMaxRadiusMulti: DEFAULT_SHOCKWAVE_MULTI,
  },
};

const REAVERS_BASE: Record<ShipHull, ExplosionConfigEntry> = {
  fighter: {
    baseRadius: 3.2 * EXPLOSION_SCALE,
    flashIntensity: 1.2,
    lightColor: '#ff8447',
    lightFalloff: 40,
    debrisCount: 7 * EXPLOSION_SCALE,
    particleCounts: {
      sparks: 14 * EXPLOSION_SCALE,
      plasma: 6 * EXPLOSION_SCALE,
      smoke: 9 * EXPLOSION_SCALE,
    },
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
      debrisSpeed: [12 * EXPLOSION_SCALE, 25 * EXPLOSION_SCALE] as [number, number],
    },
    shockwaveMaxRadiusMulti: DEFAULT_SHOCKWAVE_MULTI,
  },
  corvette: {
    baseRadius: 3.9 * EXPLOSION_SCALE,
    flashIntensity: 1.25,
    lightColor: '#ff8447',
    lightFalloff: 55,
    debrisCount: 9 * EXPLOSION_SCALE,
    particleCounts: {
      sparks: 16 * EXPLOSION_SCALE,
      plasma: 8 * EXPLOSION_SCALE,
      smoke: 11 * EXPLOSION_SCALE,
    },
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
      debrisSpeed: [13 * EXPLOSION_SCALE, 26 * EXPLOSION_SCALE] as [number, number],
    },
    shockwaveMaxRadiusMulti: DEFAULT_SHOCKWAVE_MULTI,
  },
  frigate: {
    baseRadius: 4.8 * EXPLOSION_SCALE,
    flashIntensity: 1.32,
    lightColor: '#ff8447',
    lightFalloff: 65,
    debrisCount: 12 * EXPLOSION_SCALE,
    particleCounts: {
      sparks: 18 * EXPLOSION_SCALE,
      plasma: 10 * EXPLOSION_SCALE,
      smoke: 14 * EXPLOSION_SCALE,
    },
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
      debrisSpeed: [14 * EXPLOSION_SCALE, 28 * EXPLOSION_SCALE] as [number, number],
    },
    shockwaveMaxRadiusMulti: DEFAULT_SHOCKWAVE_MULTI,
  },
  destroyer: {
    baseRadius: 5.8 * EXPLOSION_SCALE,
    flashIntensity: 1.38,
    lightColor: '#ff8447',
    lightFalloff: 80,
    debrisCount: 15 * EXPLOSION_SCALE,
    particleCounts: {
      sparks: 22 * EXPLOSION_SCALE,
      plasma: 12 * EXPLOSION_SCALE,
      smoke: 16 * EXPLOSION_SCALE,
    },
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
      debrisSpeed: [15 * EXPLOSION_SCALE, 30 * EXPLOSION_SCALE] as [number, number],
    },
    shockwaveMaxRadiusMulti: DEFAULT_SHOCKWAVE_MULTI,
  },
  carrier: {
    baseRadius: 7.6 * EXPLOSION_SCALE,
    flashIntensity: 1.45,
    lightColor: '#ff8447',
    lightFalloff: 95,
    debrisCount: 20 * EXPLOSION_SCALE,
    particleCounts: {
      sparks: 26 * EXPLOSION_SCALE,
      plasma: 16 * EXPLOSION_SCALE,
      smoke: 20 * EXPLOSION_SCALE,
    },
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
      debrisSpeed: [16 * EXPLOSION_SCALE, 35 * EXPLOSION_SCALE] as [number, number],
    },
    shockwaveMaxRadiusMulti: DEFAULT_SHOCKWAVE_MULTI,
  },
};

export const EXPLOSION_CONFIG: Record<ExplosionFaction, Record<ShipHull, ExplosionConfigEntry>> = {
  alliance: ALLIANCE_BASE,
  reavers: REAVERS_BASE,
};

export const DEFAULT_EXPLOSION_CONFIG: ExplosionConfigEntry = {
  baseRadius: 3.5 * EXPLOSION_SCALE,
  flashIntensity: 1.2,
  lightColor: '#ffb347',
  lightFalloff: 60,
  debrisCount: 8 * EXPLOSION_SCALE,
  particleCounts: {
    sparks: 14 * EXPLOSION_SCALE,
    plasma: 8 * EXPLOSION_SCALE,
    smoke: 10 * EXPLOSION_SCALE,
  },
  palette: {
    flash: '#ffb347',
    shockwave: '#ff7847',
    fireballHot: '#ff6138',
    smoke: '#4a281c',
  },
  timing: {
    ...DEFAULT_TIMING,
    debrisSpeed: [
      DEFAULT_TIMING.debrisSpeed[0] * EXPLOSION_SCALE,
      DEFAULT_TIMING.debrisSpeed[1] * EXPLOSION_SCALE,
    ],
  },
  shockwaveMaxRadiusMulti: DEFAULT_SHOCKWAVE_MULTI,
};

export function getExplosionConfig(
  faction: ExplosionFaction,
  hull: ShipHull,
): ExplosionConfigEntry {
  const factionMap = EXPLOSION_CONFIG[faction];
  if (!factionMap) return DEFAULT_EXPLOSION_CONFIG;
  return factionMap[hull] ?? DEFAULT_EXPLOSION_CONFIG;
}
