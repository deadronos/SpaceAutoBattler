import type { ExplosionConfigEntry, ShipHull } from '../../types/index.js';

/**
 * Factions that can have distinct explosion styles.
 */
export type ExplosionFaction = 'alliance' | 'reavers';

/** Default particle counts for explosions. */
export const DEFAULT_PARTICLE_COUNTS = { sparks: 10, plasma: 6, smoke: 8 } as const;

/** Default timing parameters for explosion stages. */
export const DEFAULT_TIMING = {
  duration: 1.8,
  lightDuration: 0.25,
  shockwave: { delay: 0.08, duration: 0.32 },
  fireball: { delay: 0.2, duration: 0.4 },
  debrisSpeed: [12, 26] as [number, number],
} as const;

/** Global scale factor for all explosions. */
export const EXPLOSION_SCALE = 2;

/** Default multiplier for shockwave radius relative to base radius. */
export const DEFAULT_SHOCKWAVE_MULTI = 5.0;

/**
 * Scales a numeric range by the global explosion scale.
 *
 * @param {[number, number]} range - The min/max range to scale.
 * @returns {[number, number]} The scaled range.
 */
export const scaleRange = (range: [number, number]): [number, number] => [
  range[0] * EXPLOSION_SCALE,
  range[1] * EXPLOSION_SCALE,
];

/**
 * Baseline explosion configuration used as a fallback.
 */
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
    debrisSpeed: scaleRange(DEFAULT_TIMING.debrisSpeed),
  },
  shockwaveMaxRadiusMulti: DEFAULT_SHOCKWAVE_MULTI,
};

/**
 * Map of ship hull types to explosion configurations.
 */
export type ExplosionPresetMap = Record<ShipHull, ExplosionConfigEntry>;
