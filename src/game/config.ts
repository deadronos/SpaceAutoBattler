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

// Helper to read URL query parameters for runtime configuration
function readQueryParam(name: string): string | null {
  try {
    if (typeof window !== 'undefined' && window.location) {
      const params = new URLSearchParams(window.location.search);
      return params.get(name);
    }
  } catch {
    // Ignore errors in non-browser environments
  }
  return null;
}

function readBooleanParam(name: string, defaultValue: boolean): boolean {
  const query = readQueryParam(name);
  if (query !== null) {
    const normalized = query.toLowerCase();
    return normalized === '1' || normalized === 'true' || normalized === 'on';
  }
  return defaultValue;
}

function readStringParam(name: string, defaultValue: string): string {
  const query = readQueryParam(name);
  return query || defaultValue;
}

const DEFAULT_AI_V2 = readBooleanEnv('AI_V2_DEFAULT', true);
const TICK_RATE_BASE = 12;

// Tick rate experiment flags
const TICK_RATE_EXPERIMENTAL = 15;
const TICK_RATE_FORCE_ON = readBooleanEnv('AI_TICKRATE_EXPERIMENT_ON');
const TICK_RATE_FORCE_OFF = readBooleanEnv('AI_TICKRATE_EXPERIMENT_OFF');
const TICK_RATE_EXPERIMENT_ENABLED = TICK_RATE_FORCE_OFF
  ? false
  : TICK_RATE_FORCE_ON
  ? true
  : true;
const TICK_RATE_EFFECTIVE = TICK_RATE_EXPERIMENT_ENABLED ? TICK_RATE_EXPERIMENTAL : TICK_RATE_BASE;

// Vertical maneuver experiment flags
const VERTICAL_FORCE_ON = readBooleanEnv('AI_VERTICAL_EXPERIMENT_ON');
const VERTICAL_FORCE_OFF = readBooleanEnv('AI_VERTICAL_EXPERIMENT_OFF');
const VERTICAL_DEFAULT = VERTICAL_FORCE_OFF
  ? false
  : VERTICAL_FORCE_ON
  ? true
  : true; // Current default
const VERTICAL_EXPERIMENT_ENABLED = readBooleanParam('ai_vertical', VERTICAL_DEFAULT);

// Engagement boost experiment flags
const ENGAGEMENT_BOOST_FORCE_ON = readBooleanEnv('AI_ENGAGEMENT_BOOST_ON');
const ENGAGEMENT_BOOST_FORCE_OFF = readBooleanEnv('AI_ENGAGEMENT_BOOST_OFF');
const ENGAGEMENT_BOOST_DEFAULT = ENGAGEMENT_BOOST_FORCE_OFF
  ? false
  : ENGAGEMENT_BOOST_FORCE_ON
  ? true
  : true; // Current default
const ENGAGEMENT_BOOST_ENABLED = readBooleanParam('ai_engagement', ENGAGEMENT_BOOST_DEFAULT);

// Range policy experiment flags
function readStringEnv(name: string, defaultValue: string): string {
  try {
    const source = globalThis as unknown as { process?: { env?: Record<string, string | undefined> } };
    const raw = source.process?.env?.[name];
    return raw || defaultValue;
  } catch {
    return defaultValue;
  }
}

const RANGE_POLICY_OVERRIDE = readStringEnv('AI_RANGE_POLICY', '');
const RANGE_POLICY_DEFAULT = RANGE_POLICY_OVERRIDE ? RANGE_POLICY_OVERRIDE : 'v0.1.1-exp' as const; // Current default
const RANGE_POLICY_EFFECTIVE = readStringParam('ai_range_policy', RANGE_POLICY_DEFAULT);

// Update tick rate to also support query params for consistency
const TICK_RATE_QUERY_OVERRIDE = readQueryParam('ai_tick_rate');
const TICK_RATE_EXPERIMENT_QUERY = readBooleanParam('ai_tick_experiment', TICK_RATE_EXPERIMENT_ENABLED);
const TICK_RATE_FINAL = TICK_RATE_QUERY_OVERRIDE 
  ? TICK_RATE_QUERY_OVERRIDE === 'experimental' || TICK_RATE_QUERY_OVERRIDE === '15'
  : TICK_RATE_EXPERIMENT_QUERY;
const TICK_RATE_EFFECTIVE_FINAL = TICK_RATE_FINAL ? TICK_RATE_EXPERIMENTAL : TICK_RATE_BASE;

// Debug logging for feature flag configuration (only in development)
if (typeof globalThis !== 'undefined' && globalThis.console) {
  const isDev = readQueryParam('debug') === 'config' || readBooleanEnv('DEBUG_CONFIG');
  if (isDev) {
    console.log('🔧 AI Feature Flag Configuration:');
    console.log(`  verticalEnabled: ${VERTICAL_EXPERIMENT_ENABLED} (env: ${VERTICAL_FORCE_ON ? 'ON' : VERTICAL_FORCE_OFF ? 'OFF' : 'default'})`);
    console.log(`  engagementBoostEnabled: ${ENGAGEMENT_BOOST_ENABLED} (env: ${ENGAGEMENT_BOOST_FORCE_ON ? 'ON' : ENGAGEMENT_BOOST_FORCE_OFF ? 'OFF' : 'default'})`);
    console.log(`  tickRateHzExperiment: ${TICK_RATE_FINAL} (env: ${TICK_RATE_FORCE_ON ? 'ON' : TICK_RATE_FORCE_OFF ? 'OFF' : 'default'})`);
    console.log(`  rangePolicy: ${RANGE_POLICY_EFFECTIVE} (env: ${RANGE_POLICY_OVERRIDE || 'default'})`);
  }
}

export const AI_CONFIG = {
  v2Enabled: DEFAULT_AI_V2,
  tickRateHzBase: TICK_RATE_BASE,
  tickRateHzExperimental: TICK_RATE_EXPERIMENTAL,
  tickRateHzExperiment: TICK_RATE_FINAL,
  tickRateHz: TICK_RATE_EFFECTIVE_FINAL,
  maxPerTick: 60,
  slices: 5,
  verticalEnabled: VERTICAL_EXPERIMENT_ENABLED,
  engagementBoostEnabled: ENGAGEMENT_BOOST_ENABLED,
  rangePolicy: RANGE_POLICY_EFFECTIVE,
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

/**
 * Runtime AI Configuration Helpers
 * 
 * These functions check for runtime overrides from the UI store and return
 * the effective configuration values, allowing for real-time experimentation.
 */

// Lazy import to avoid circular dependency
let _useUiStore: any = null;
function getUiStore() {
  if (_useUiStore === null) {
    // Dynamic import to avoid circular dependency
    _useUiStore = require('./uiStore.js').useUiStore;
  }
  return _useUiStore;
}

export function getEffectiveAIConfig() {
  try {
    const uiState = getUiStore().getState();
    return {
      ...AI_CONFIG,
      verticalEnabled: uiState.aiVerticalEnabled ?? AI_CONFIG.verticalEnabled,
      engagementBoostEnabled: uiState.aiEngagementBoostEnabled ?? AI_CONFIG.engagementBoostEnabled,
      tickRateHzExperiment: uiState.aiTickRateExperimentEnabled ?? AI_CONFIG.tickRateHzExperiment,
      rangePolicy: uiState.aiRangePolicy ?? AI_CONFIG.rangePolicy,
    };
  } catch {
    // Fallback to static config if UI store is not available
    return AI_CONFIG;
  }
}

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
