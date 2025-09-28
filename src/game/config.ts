// Centralized world configuration
// A cubic world sized WORLD_SIZE^3 centered at the origin.
// Keep gameplay deterministic: no randomness here.

export const WORLD_SIZE = 8000; // length of one edge of the world cube
export const WORLD_HALF = WORLD_SIZE / 2; // half-extent from origin to any face

// Camera defaults tuned for the larger world scale; consumers may override.
export const CAMERA_DEFAULTS = {
  position: [0, 600, 1600] as const,
  fov: 55,
  near: 0.1,
  far: WORLD_SIZE * 10,
};

// Fog tuned for deep space look at larger scales
export const FOG_DEFAULTS: readonly [string, number, number] = [
  '#02030b',
  WORLD_SIZE * 0.8,
  WORLD_SIZE * 10,
];

// AI configuration
function readBooleanEnv(name: string, defaultValue = false): boolean {
  try {
    const source = globalThis as unknown as { process?: { env?: Record<string, string | undefined> } };
    const raw = source.process?.env?.[name];
    if (!raw) return defaultValue;
    const normalized = raw.toLowerCase();
    return normalized === '1' || normalized === 'true' || normalized === 'on';
  } catch {
    return defaultValue;
  }
}

const DEFAULT_AI_V2 = readBooleanEnv('AI_V2_DEFAULT', true);
const TICK_RATE_BASE = 12;
const TICK_RATE_EXPERIMENTAL = 15;
const TICK_RATE_FORCE_ON = readBooleanEnv('AI_TICKRATE_EXPERIMENT_ON');
const TICK_RATE_FORCE_OFF = readBooleanEnv('AI_TICKRATE_EXPERIMENT_OFF');
const TICK_RATE_EXPERIMENT_ENABLED = TICK_RATE_FORCE_OFF
  ? false
  : TICK_RATE_FORCE_ON
  ? true
  : true;
const TICK_RATE_EFFECTIVE = TICK_RATE_EXPERIMENT_ENABLED ? TICK_RATE_EXPERIMENTAL : TICK_RATE_BASE;

export const AI_CONFIG = {
  v2Enabled: DEFAULT_AI_V2,
  tickRateHzBase: TICK_RATE_BASE,
  tickRateHzExperimental: TICK_RATE_EXPERIMENTAL,
  tickRateHzExperiment: TICK_RATE_EXPERIMENT_ENABLED,
  tickRateHz: TICK_RATE_EFFECTIVE,
  maxPerTick: 60,
  slices: 5,
  verticalEnabled: true,
  engagementBoostEnabled: true,
  rangePolicy: 'v0.1.1-exp' as const,
  openingSalvoDuration: 30,
  openingSalvoAggressionBoost: 1.2,
  headingYClamp: 0.3,
  strengthRatioThreshold: 1.6,
  bandStickinessDuration: 3,
  scorePrecision: 0.1,
  intentPriority: ['Attack', 'Intercept', 'Escort', 'Kite', 'Reposition', 'Regroup', 'Flee'] as const,
  threatWeights: {
    hull: {
      carrier: 6,
      destroyer: 5,
      frigate: 4,
      corvette: 3,
      fighter: 2,
    } as const,
    hpScalar: 0.0025,
    vipBonus: 3,
    focusPenalty: 1.2,
    distanceScale: 600,
  },
  lod: {
    activeDistance: 320,
    idleDistance: 900,
  },
};

export const SPAWN_CONFIG = {
  verticalSpreadFactor: 0.2,
  anchorYRandomization: true,
  initialSeparationFactor: 1.5,
} as const;

// AI and movement configuration
export const WORLD_BOUNDS_MARGIN = 2; // small margin to stay slightly within the cube

// Helper to clamp a position vector to the world cube bounds (inclusive)
export function clampToWorld(v: { x: number; y: number; z: number }): void {
  const min = -WORLD_HALF + WORLD_BOUNDS_MARGIN;
  const max = WORLD_HALF - WORLD_BOUNDS_MARGIN;
  v.x = Math.min(Math.max(v.x, min), max);
  v.y = Math.min(Math.max(v.y, min), max);
  v.z = Math.min(Math.max(v.z, min), max);
}
