import { clamp } from '../utils/math.js';

// Centralized world configuration
// A cubic world sized WORLD_SIZE^3 centered at the origin.
// Keep gameplay deterministic: no randomness here.

/**
 * World edge length in units. The world is a cube centered at the origin.
 */
export const WORLD_SIZE = 8000; // length of one edge of the world cube
/**
 * Distance from the origin to any face of the world cube.
 */
export const WORLD_HALF = WORLD_SIZE / 2; // half-extent from origin to any face

// Camera defaults tuned for the larger world scale; consumers may override.
/**
 * Default camera settings.
 */
export const CAMERA_DEFAULTS = {
  position: [0, 600, 1600] as const,
  fov: 55,
  near: 0.1,
  far: WORLD_SIZE * 10,
};

// Fog tuned for deep space look at larger scales
/**
 * Default fog configuration.
 */
export const FOG_DEFAULTS: readonly [string, number, number] = [
  '#02030b',
  WORLD_SIZE * 0.8,
  WORLD_SIZE * 10,
];

// AI configuration
function readEnv<T extends string | boolean>(
  name: string,
  defaultValue: T,
  parser?: (raw: string) => T,
): T {
  try {
    const source = globalThis as unknown as {
      process?: { env?: Record<string, string | undefined> };
    };
    const raw = source.process?.env?.[name];
    if (!raw) return defaultValue;

    if (parser) {
      return parser(raw);
    }

    // Boolean parsing if default is boolean
    if (typeof defaultValue === 'boolean') {
      const normalized = raw.toLowerCase();
      return (normalized === '1' || normalized === 'true' || normalized === 'on') as T;
    }

    // String return
    return raw as T;
  } catch {
    return defaultValue;
  }
}

function readBooleanEnv(name: string, defaultValue = false): boolean {
  return readEnv(name, defaultValue);
}

function readStringEnv(name: string, defaultValue: string): string {
  return readEnv(name, defaultValue);
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

const REQUESTED_AI_V2_DEFAULT = readBooleanEnv('AI_V2_DEFAULT', true);
const DEFAULT_AI_V2 = true;
if (!REQUESTED_AI_V2_DEFAULT && typeof globalThis !== 'undefined') {
  try {
    globalThis.console?.warn?.(
      'AI v2 fallback has been removed; ignoring AI_V2_DEFAULT=false and forcing v2 on.',
    );
  } catch {
    // ignore logging failures
  }
}
const TICK_RATE_BASE = 12;

// Tick rate experiment flags
const TICK_RATE_EXPERIMENTAL = 15;
const TICK_RATE_FORCE_ON = readBooleanEnv('AI_TICKRATE_EXPERIMENT_ON');
const TICK_RATE_FORCE_OFF = readBooleanEnv('AI_TICKRATE_EXPERIMENT_OFF');
const TICK_RATE_EXPERIMENT_ENABLED = TICK_RATE_FORCE_OFF ? false : TICK_RATE_FORCE_ON ? true : true;

// Vertical maneuver experiment flags
const VERTICAL_FORCE_ON = readBooleanEnv('AI_VERTICAL_EXPERIMENT_ON');
const VERTICAL_FORCE_OFF = readBooleanEnv('AI_VERTICAL_EXPERIMENT_OFF');
const VERTICAL_DEFAULT = VERTICAL_FORCE_OFF ? false : VERTICAL_FORCE_ON ? true : true; // Current default
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
const RANGE_POLICY_OVERRIDE = readStringEnv('AI_RANGE_POLICY', '');
const RANGE_POLICY_DEFAULT = RANGE_POLICY_OVERRIDE
  ? RANGE_POLICY_OVERRIDE
  : ('v0.1.1-exp' as const); // Current default
const RANGE_POLICY_EFFECTIVE = readStringParam('ai_range_policy', RANGE_POLICY_DEFAULT);

// Update tick rate to also support query params for consistency
const TICK_RATE_QUERY_OVERRIDE = readQueryParam('ai_tick_rate');
const TICK_RATE_EXPERIMENT_QUERY = readBooleanParam(
  'ai_tick_experiment',
  TICK_RATE_EXPERIMENT_ENABLED,
);
const TICK_RATE_FINAL = TICK_RATE_QUERY_OVERRIDE
  ? TICK_RATE_QUERY_OVERRIDE === 'experimental' || TICK_RATE_QUERY_OVERRIDE === '15'
  : TICK_RATE_EXPERIMENT_QUERY;
const TICK_RATE_EFFECTIVE_FINAL = TICK_RATE_FINAL ? TICK_RATE_EXPERIMENTAL : TICK_RATE_BASE;

// Debug logging for feature flag configuration (only in development)
if (typeof globalThis !== 'undefined' && globalThis.console) {
  const isDev = readQueryParam('debug') === 'config' || readBooleanEnv('DEBUG_CONFIG');
  if (isDev) {
    console.log('🔧 AI Feature Flag Configuration:');
    console.log(
      `  verticalEnabled: ${VERTICAL_EXPERIMENT_ENABLED} (env: ${VERTICAL_FORCE_ON ? 'ON' : VERTICAL_FORCE_OFF ? 'OFF' : 'default'})`,
    );
    console.log(
      `  engagementBoostEnabled: ${ENGAGEMENT_BOOST_ENABLED} (env: ${ENGAGEMENT_BOOST_FORCE_ON ? 'ON' : ENGAGEMENT_BOOST_FORCE_OFF ? 'OFF' : 'default'})`,
    );
    console.log(
      `  tickRateHzExperiment: ${TICK_RATE_FINAL} (env: ${TICK_RATE_FORCE_ON ? 'ON' : TICK_RATE_FORCE_OFF ? 'OFF' : 'default'})`,
    );
    console.log(
      `  rangePolicy: ${RANGE_POLICY_EFFECTIVE} (env: ${RANGE_POLICY_OVERRIDE || 'default'})`,
    );
  }
}

/**
 * Global AI configuration settings.
 */
export const AI_CONFIG = {
  v2Enabled: DEFAULT_AI_V2,
  tickRateHzBase: TICK_RATE_BASE,
  tickRateHzExperimental: TICK_RATE_EXPERIMENTAL,
  tickRateHzExperiment: TICK_RATE_FINAL,
  tickRateHz: TICK_RATE_EFFECTIVE_FINAL,
  maxPerTick: 60,
  slices: 5,
  verticalEnabled: VERTICAL_EXPERIMENT_ENABLED,
  // Feature toggles for runtime experiments
  smoothingEnabled: true,
  hysteresisEnabled: true,
  verticalDampingEnabled: true,
  engagementBoostEnabled: ENGAGEMENT_BOOST_ENABLED,
  rangePolicy: RANGE_POLICY_EFFECTIVE,
  openingSalvoDuration: 30,
  openingSalvoAggressionBoost: 1.2,
  headingYClamp: 0.3,
  verticalClamp: {
    default: 0.45,
    highAgility: 0.6,
    heavy: 0.35,
  } as const,
  interruptHpDrop: 0.1,
  interruptCooldownTicks: 1,
  strengthRatioThreshold: 1.6,
  bandStickinessDuration: 3,
  scorePrecision: 0.1,
  intentPriority: [
    'Attack',
    'Intercept',
    'Escort',
    'Kite',
    'Reposition',
    'Regroup',
    'Flee',
  ] as const,
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

interface UiStoreSlice {
  aiVerticalEnabled: boolean | null | undefined;
  aiEngagementBoostEnabled: boolean | null | undefined;
  aiTickRateExperimentEnabled: boolean | null | undefined;
  aiRangePolicy: string | null | undefined;
  aiSmoothingEnabled?: boolean | null | undefined;
  aiHysteresisEnabled?: boolean | null | undefined;
  aiVerticalDampingEnabled?: boolean | null | undefined;
}

interface UiStoreLike {
  getState(): UiStoreSlice;
}

function resolveUiStore(): UiStoreLike | null {
  try {
    const possibleStore = (globalThis as { __spaceAutobattlerUiStore?: unknown })
      .__spaceAutobattlerUiStore;
    if (possibleStore && typeof (possibleStore as { getState?: unknown }).getState === 'function') {
      return possibleStore as UiStoreLike;
    }
  } catch {
    // ignore resolution errors in non-browser environments
  }
  return null;
}

/**
 * Retrieves the effective AI configuration, accounting for runtime UI overrides.
 *
 * @returns {typeof AI_CONFIG} The effective AI configuration.
 */
export function getEffectiveAIConfig() {
  const uiStore = resolveUiStore();
  if (!uiStore) {
    return AI_CONFIG;
  }

  try {
    const uiState = uiStore.getState();
    return {
      ...AI_CONFIG,
      verticalEnabled: uiState.aiVerticalEnabled ?? AI_CONFIG.verticalEnabled,
      engagementBoostEnabled: uiState.aiEngagementBoostEnabled ?? AI_CONFIG.engagementBoostEnabled,
      smoothingEnabled: uiState.aiSmoothingEnabled ?? AI_CONFIG.smoothingEnabled,
      hysteresisEnabled: uiState.aiHysteresisEnabled ?? AI_CONFIG.hysteresisEnabled,
      verticalDampingEnabled: uiState.aiVerticalDampingEnabled ?? AI_CONFIG.verticalDampingEnabled,
      tickRateHzExperiment: uiState.aiTickRateExperimentEnabled ?? AI_CONFIG.tickRateHzExperiment,
      rangePolicy: uiState.aiRangePolicy ?? AI_CONFIG.rangePolicy,
    };
  } catch {
    // Fallback to static config if UI store state cannot be read
    return AI_CONFIG;
  }
}

/**
 * Configuration for fleet spawning.
 */
export const SPAWN_CONFIG = {
  verticalSpreadFactor: 0.2,
  anchorYRandomization: true,
  initialSeparationFactor: 1.5,
} as const;

// AI and movement configuration
/**
 * Margin to keep ships away from the absolute world boundary.
 */
export const WORLD_BOUNDS_MARGIN = 2; // small margin to stay slightly within the cube

/**
 * Clamps a position vector to strictly stay within the world bounds.
 * Modifies the vector in-place.
 *
 * @param {{ x: number; y: number; z: number }} v - The position vector to clamp.
 */
export function clampToWorld(v: { x: number; y: number; z: number }): void {
  const min = -WORLD_HALF + WORLD_BOUNDS_MARGIN;
  const max = WORLD_HALF - WORLD_BOUNDS_MARGIN;
  v.x = clamp(v.x, min, max);
  v.y = clamp(v.y, min, max);
  v.z = clamp(v.z, min, max);
}
