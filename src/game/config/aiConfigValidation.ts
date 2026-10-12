// Pure, side-effect-free validators for the AI flag surface.
//
// `validateAiConfig` returns a list of human-readable issues (empty = valid) so
// it can be unit-tested without touching the error reporter. The startup wiring
// in `./aiConfig.ts` is the only side-effectful call site.
//
// `sanitizeAiOverrides` normalises a runtime override slice: wrong-typed values
// are coerced to `null` (i.e. fall back to the `AI_CONFIG` default) and reported
// via `reportConfigError`. Valid values pass through untouched, so determinism
// is preserved for valid inputs.

import { reportConfigError } from '../../utils/errorReporting.js';
import type { AI_CONFIG } from './aiConfig.js';
import type { AiOverrideSlice } from './aiOverrides.js';

type AiConfig = typeof AI_CONFIG;

/** Known `AIState['intent']` values, used to validate `intentPriority`. */
const KNOWN_INTENTS: ReadonlySet<string> = new Set([
  'Attack',
  'Kite',
  'Escort',
  'Intercept',
  'Flee',
  'Regroup',
  'Reposition',
]);

function isBoolean(value: unknown): value is boolean {
  return typeof value === 'boolean';
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isPositiveFinite(value: unknown): value is number {
  return isFiniteNumber(value) && value > 0;
}

function isIntegerAtLeast(value: unknown, min: number): value is number {
  return isFiniteNumber(value) && Number.isInteger(value) && value >= min;
}

function isInUnitInterval(value: unknown): value is number {
  return isFiniteNumber(value) && value >= 0 && value <= 1;
}

function isNonNegativeFinite(value: unknown): value is number {
  return isFiniteNumber(value) && value >= 0;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

function describe(value: unknown): string {
  if (typeof value === 'number') return String(value);
  if (typeof value === 'string') return JSON.stringify(value);
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  return typeof value;
}

function checkAll(
  issues: string[],
  entries: ReadonlyArray<readonly [string, unknown]>,
  predicate: (value: unknown) => boolean,
  expectation: string,
): void {
  for (const [key, value] of entries) {
    if (!predicate(value)) {
      issues.push(`AI_CONFIG.${key} must be ${expectation} (received ${describe(value)})`);
    }
  }
}

/**
 * Validates the resolved `AI_CONFIG` constants. Returns an empty array when the
 * configuration is valid.
 *
 * @param {AiConfig} config - The resolved AI configuration to validate.
 * @returns {string[]} Human-readable issue strings (empty = valid).
 */
export function validateAiConfig(config: AiConfig): string[] {
  const issues: string[] = [];

  checkAll(
    issues,
    [
      ['v2Enabled', config.v2Enabled],
      ['verticalEnabled', config.verticalEnabled],
      ['smoothingEnabled', config.smoothingEnabled],
      ['hysteresisEnabled', config.hysteresisEnabled],
      ['verticalDampingEnabled', config.verticalDampingEnabled],
      ['engagementBoostEnabled', config.engagementBoostEnabled],
      ['tickRateHzExperiment', config.tickRateHzExperiment],
    ],
    isBoolean,
    'a boolean',
  );

  checkAll(
    issues,
    [
      ['tickRateHzBase', config.tickRateHzBase],
      ['tickRateHzExperimental', config.tickRateHzExperimental],
      ['tickRateHz', config.tickRateHz],
      ['scorePrecision', config.scorePrecision],
      ['threatWeights.distanceScale', config.threatWeights.distanceScale],
    ],
    isPositiveFinite,
    'a positive finite number',
  );

  checkAll(
    issues,
    [
      ['maxPerTick', config.maxPerTick],
      ['slices', config.slices],
    ],
    (value) => isIntegerAtLeast(value, 1),
    'an integer >= 1',
  );

  checkAll(
    issues,
    [
      ['interruptCooldownTicks', config.interruptCooldownTicks],
      ['bandStickinessDuration', config.bandStickinessDuration],
    ],
    (value) => isIntegerAtLeast(value, 0),
    'an integer >= 0',
  );

  checkAll(
    issues,
    [
      ['headingYClamp', config.headingYClamp],
      ['verticalClamp.default', config.verticalClamp.default],
      ['verticalClamp.highAgility', config.verticalClamp.highAgility],
      ['verticalClamp.heavy', config.verticalClamp.heavy],
      ['interruptHpDrop', config.interruptHpDrop],
    ],
    isInUnitInterval,
    'a number in [0, 1]',
  );

  checkAll(
    issues,
    [
      ['openingSalvoDuration', config.openingSalvoDuration],
      ['openingSalvoAggressionBoost', config.openingSalvoAggressionBoost],
      ['strengthRatioThreshold', config.strengthRatioThreshold],
      ['lod.activeDistance', config.lod.activeDistance],
      ['lod.idleDistance', config.lod.idleDistance],
      ['threatWeights.hpScalar', config.threatWeights.hpScalar],
      ['threatWeights.vipBonus', config.threatWeights.vipBonus],
      ['threatWeights.focusPenalty', config.threatWeights.focusPenalty],
      ['threatWeights.hull.carrier', config.threatWeights.hull.carrier],
      ['threatWeights.hull.destroyer', config.threatWeights.hull.destroyer],
      ['threatWeights.hull.frigate', config.threatWeights.hull.frigate],
      ['threatWeights.hull.corvette', config.threatWeights.hull.corvette],
      ['threatWeights.hull.fighter', config.threatWeights.hull.fighter],
    ],
    isNonNegativeFinite,
    'a finite number >= 0',
  );

  if (!isNonEmptyString(config.rangePolicy)) {
    issues.push(
      `AI_CONFIG.rangePolicy must be a non-empty string (received ${describe(config.rangePolicy)})`,
    );
  }

  const intentPriority: readonly unknown[] = config.intentPriority;
  if (intentPriority.length === 0) {
    issues.push('AI_CONFIG.intentPriority must be a non-empty array of intent names');
  } else {
    for (const intent of intentPriority) {
      if (typeof intent !== 'string' || !KNOWN_INTENTS.has(intent)) {
        issues.push(`AI_CONFIG.intentPriority contains unknown intent ${describe(intent)}`);
      }
    }
  }

  return issues;
}

const BOOLEAN_OVERRIDE_KEYS = [
  'aiVerticalEnabled',
  'aiEngagementBoostEnabled',
  'aiTickRateExperimentEnabled',
  'aiSmoothingEnabled',
  'aiHysteresisEnabled',
  'aiVerticalDampingEnabled',
] as const;

const STRING_OVERRIDE_KEYS = ['aiRangePolicy'] as const;

/**
 * Normalises a runtime AI-override slice. Wrong-typed entries are coerced to
 * `null` (falling back to the `AI_CONFIG` default) and reported through
 * `reportConfigError`. Valid values pass through untouched; unknown keys are
 * dropped so a provider that returns a superset (e.g. the full UI store) does
 * not produce false-positive warnings.
 *
 * @param {AiOverrideSlice} slice - The raw override slice from the provider.
 * @returns {AiOverrideSlice} A slice containing only the recognised override keys.
 */
export function sanitizeAiOverrides(slice: AiOverrideSlice): AiOverrideSlice {
  const source = slice as unknown as Record<string, unknown>;
  const sanitized: Record<string, boolean | string | null> = {};

  for (const key of BOOLEAN_OVERRIDE_KEYS) {
    const value = source[key];
    if (value === undefined || value === null || typeof value === 'boolean') {
      sanitized[key] = value ?? null;
    } else {
      reportConfigError(
        `aiOverrides.${key}`,
        new Error(`expected boolean | null, received ${describe(value)}`),
      );
      sanitized[key] = null;
    }
  }

  for (const key of STRING_OVERRIDE_KEYS) {
    const value = source[key];
    if (value === undefined || value === null || typeof value === 'string') {
      sanitized[key] = value ?? null;
    } else {
      reportConfigError(
        `aiOverrides.${key}`,
        new Error(`expected string | null, received ${describe(value)}`),
      );
      sanitized[key] = null;
    }
  }

  return sanitized as unknown as AiOverrideSlice;
}
