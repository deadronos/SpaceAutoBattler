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
function readBooleanEnv(name: string): boolean {
  try {
    const source = globalThis as unknown as { process?: { env?: Record<string, string | undefined> } };
    const raw = source.process?.env?.[name];
    if (!raw) return false;
    const normalized = raw.toLowerCase();
    return normalized === '1' || normalized === 'true' || normalized === 'on';
  } catch {
    return false;
  }
}

const DEFAULT_AI_V2 = readBooleanEnv('AI_V2_DEFAULT');

export const AI_CONFIG = {
  v2Enabled: DEFAULT_AI_V2,
  tickRateHz: 15,
  maxPerTick: 60,
  slices: 5,
  verticalEnabled: true,
  engagementBoostEnabled: true,
  rangePolicy: 'v0.1.1-exp' as const,
  openingSalvoDuration: 30,
  headingYClamp: 0.3,
  strengthRatioThreshold: 1.6,
  bandStickinessDuration: 3,
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
