import { reportConfigError } from '../../utils/errorReporting.js';
import { readBooleanEnv, readStringEnv } from '../../utils/env.js';
import { readBooleanParam, readQueryParam, readStringParam } from '../../utils/queryParams.js';

// AI configuration.
// Env/query readers live in ../../utils/env.js and ../../utils/queryParams.js.

const REQUESTED_AI_V2_DEFAULT = readBooleanEnv('AI_V2_DEFAULT', true);
const DEFAULT_AI_V2 = true;
if (!REQUESTED_AI_V2_DEFAULT && typeof globalThis !== 'undefined') {
  try {
    globalThis.console?.warn?.(
      'AI v2 fallback has been removed; ignoring AI_V2_DEFAULT=false and forcing v2 on.',
    );
  } catch (error) {
    reportConfigError('AI_V2_DEFAULT', error);
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
  } catch (error) {
    reportConfigError('__spaceAutobattlerUiStore', error);
  }
  return null;
}

/**
 * Retrieves the effective AI configuration, accounting for runtime UI overrides.
 *
 * @returns {typeof AI_CONFIG} The effective AI configuration.
 */
function computeEffectiveAIConfig(uiState: UiStoreSlice) {
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
}

// Memoize on the resolved flag tuple. The object is read-only to callers, so a
// stable reference avoids re-allocating it on every AI decision (thousands of
// times per tick at scale).
let cachedEffectiveAIConfig: ReturnType<typeof computeEffectiveAIConfig> | null = null;
let cachedEffectiveAIConfigKey = '';

function effectiveAIConfigKey(uiState: UiStoreSlice): string {
  return [
    uiState.aiVerticalEnabled,
    uiState.aiEngagementBoostEnabled,
    uiState.aiTickRateExperimentEnabled,
    uiState.aiRangePolicy,
    uiState.aiSmoothingEnabled,
    uiState.aiHysteresisEnabled,
    uiState.aiVerticalDampingEnabled,
  ].join('|');
}

export function getEffectiveAIConfig() {
  const uiStore = resolveUiStore();
  if (!uiStore) {
    return AI_CONFIG;
  }

  try {
    const uiState = uiStore.getState();
    const key = effectiveAIConfigKey(uiState);
    if (cachedEffectiveAIConfig && key === cachedEffectiveAIConfigKey) {
      return cachedEffectiveAIConfig;
    }
    const next = computeEffectiveAIConfig(uiState);
    cachedEffectiveAIConfig = next;
    cachedEffectiveAIConfigKey = key;
    return next;
  } catch (error) {
    reportConfigError('uiStore.getState', error);
    return AI_CONFIG;
  }
}
