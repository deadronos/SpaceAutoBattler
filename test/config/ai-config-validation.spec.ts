import { afterEach, describe, expect, it } from 'vite-plus/test';
import {
  AI_CONFIG,
  getEffectiveAIConfig,
  sanitizeAiOverrides,
  setAiOverrideProvider,
  validateAiConfig,
  type AiOverrideSlice,
} from '../../src/game/config.js';
import { getGameErrors, resetGameErrorReporting } from '../../src/game/errors.js';

type MutableConfig = Record<string, unknown>;

function cloneConfig(): MutableConfig {
  return structuredClone(AI_CONFIG) as unknown as MutableConfig;
}

function issuesFor(mutate: (config: MutableConfig) => void): string[] {
  const clone = cloneConfig();
  mutate(clone);
  return validateAiConfig(clone as unknown as typeof AI_CONFIG);
}

function verticalClamp(config: MutableConfig): MutableConfig {
  return config.verticalClamp as MutableConfig;
}

function threatWeights(config: MutableConfig): MutableConfig {
  return config.threatWeights as MutableConfig;
}

function hull(config: MutableConfig): MutableConfig {
  return threatWeights(config).hull as MutableConfig;
}

function lod(config: MutableConfig): MutableConfig {
  return config.lod as MutableConfig;
}

afterEach(() => {
  setAiOverrideProvider(null);
});

describe('validateAiConfig', () => {
  it('accepts the shipped AI_CONFIG', () => {
    expect(validateAiConfig(AI_CONFIG)).toEqual([]);
  });

  const brokenCases: Array<{ name: string; mutate: (config: MutableConfig) => void }> = [
    { name: 'v2Enabled non-boolean', mutate: (c) => (c.v2Enabled = 'yes') },
    { name: 'verticalEnabled non-boolean', mutate: (c) => (c.verticalEnabled = 1) },
    { name: 'smoothingEnabled non-boolean', mutate: (c) => (c.smoothingEnabled = null) },
    { name: 'hysteresisEnabled non-boolean', mutate: (c) => (c.hysteresisEnabled = 'on') },
    { name: 'verticalDampingEnabled non-boolean', mutate: (c) => (c.verticalDampingEnabled = 0) },
    { name: 'engagementBoostEnabled non-boolean', mutate: (c) => (c.engagementBoostEnabled = {}) },
    { name: 'tickRateHzExperiment non-boolean', mutate: (c) => (c.tickRateHzExperiment = 'exp') },
    { name: 'tickRateHzBase non-positive', mutate: (c) => (c.tickRateHzBase = 0) },
    { name: 'tickRateHzExperimental non-positive', mutate: (c) => (c.tickRateHzExperimental = -1) },
    { name: 'tickRateHz non-finite', mutate: (c) => (c.tickRateHz = Number.NaN) },
    {
      name: 'scorePrecision non-finite',
      mutate: (c) => (c.scorePrecision = Number.POSITIVE_INFINITY),
    },
    {
      name: 'threatWeights.distanceScale non-positive',
      mutate: (c) => (threatWeights(c).distanceScale = 0),
    },
    { name: 'maxPerTick below 1', mutate: (c) => (c.maxPerTick = 0) },
    { name: 'slices non-integer', mutate: (c) => (c.slices = 1.5) },
    { name: 'interruptCooldownTicks negative', mutate: (c) => (c.interruptCooldownTicks = -1) },
    { name: 'bandStickinessDuration non-integer', mutate: (c) => (c.bandStickinessDuration = 2.5) },
    { name: 'headingYClamp above 1', mutate: (c) => (c.headingYClamp = 1.5) },
    {
      name: 'verticalClamp.default out of range',
      mutate: (c) => (verticalClamp(c).default = -0.1),
    },
    {
      name: 'verticalClamp.highAgility out of range',
      mutate: (c) => (verticalClamp(c).highAgility = 2),
    },
    { name: 'verticalClamp.heavy out of range', mutate: (c) => (verticalClamp(c).heavy = 1.01) },
    { name: 'interruptHpDrop out of range', mutate: (c) => (c.interruptHpDrop = 2) },
    { name: 'openingSalvoDuration negative', mutate: (c) => (c.openingSalvoDuration = -1) },
    {
      name: 'openingSalvoAggressionBoost negative',
      mutate: (c) => (c.openingSalvoAggressionBoost = -0.5),
    },
    { name: 'strengthRatioThreshold negative', mutate: (c) => (c.strengthRatioThreshold = -1) },
    { name: 'lod.activeDistance negative', mutate: (c) => (lod(c).activeDistance = -1) },
    { name: 'lod.idleDistance non-finite', mutate: (c) => (lod(c).idleDistance = Number.NaN) },
    { name: 'threatWeights.hpScalar negative', mutate: (c) => (threatWeights(c).hpScalar = -0.1) },
    { name: 'threatWeights.vipBonus negative', mutate: (c) => (threatWeights(c).vipBonus = -3) },
    {
      name: 'threatWeights.focusPenalty negative',
      mutate: (c) => (threatWeights(c).focusPenalty = -1),
    },
    { name: 'threatWeights.hull.carrier negative', mutate: (c) => (hull(c).carrier = -1) },
    { name: 'threatWeights.hull.destroyer negative', mutate: (c) => (hull(c).destroyer = -1) },
    { name: 'threatWeights.hull.frigate negative', mutate: (c) => (hull(c).frigate = -1) },
    { name: 'threatWeights.hull.corvette negative', mutate: (c) => (hull(c).corvette = -1) },
    { name: 'threatWeights.hull.fighter negative', mutate: (c) => (hull(c).fighter = -1) },
    { name: 'rangePolicy empty', mutate: (c) => (c.rangePolicy = '') },
    { name: 'rangePolicy non-string', mutate: (c) => (c.rangePolicy = 7) },
    { name: 'intentPriority empty', mutate: (c) => (c.intentPriority = []) },
    {
      name: 'intentPriority unknown intent',
      mutate: (c) => (c.intentPriority = ['Attack', 'Nope']),
    },
  ];

  for (const { name, mutate } of brokenCases) {
    it(`flags ${name}`, () => {
      expect(issuesFor(mutate).length).toBeGreaterThan(0);
    });
  }
});

describe('sanitizeAiOverrides', () => {
  it('passes valid booleans and strings through untouched', () => {
    const slice: AiOverrideSlice = {
      aiVerticalEnabled: false,
      aiEngagementBoostEnabled: true,
      aiTickRateExperimentEnabled: false,
      aiRangePolicy: 'stable',
      aiSmoothingEnabled: true,
      aiHysteresisEnabled: false,
      aiVerticalDampingEnabled: true,
    };

    expect(sanitizeAiOverrides(slice)).toEqual(slice);
  });

  it('coerces wrong-typed entries to null and reports them', () => {
    resetGameErrorReporting();
    const bad = {
      aiVerticalEnabled: 'yes',
      aiEngagementBoostEnabled: 1,
      aiTickRateExperimentEnabled: {},
      aiRangePolicy: 42,
      aiSmoothingEnabled: [],
      aiHysteresisEnabled: 'on',
      aiVerticalDampingEnabled: 0,
    } as unknown as AiOverrideSlice;

    const sanitized = sanitizeAiOverrides(bad);

    expect(sanitized.aiVerticalEnabled).toBeNull();
    expect(sanitized.aiEngagementBoostEnabled).toBeNull();
    expect(sanitized.aiTickRateExperimentEnabled).toBeNull();
    expect(sanitized.aiRangePolicy).toBeNull();
    expect(sanitized.aiSmoothingEnabled).toBeNull();
    expect(sanitized.aiHysteresisEnabled).toBeNull();
    expect(sanitized.aiVerticalDampingEnabled).toBeNull();

    const configKeys = getGameErrors(50).map((report) => report.context?.configKey);
    expect(configKeys).toContain('aiOverrides.aiVerticalEnabled');
    expect(configKeys).toContain('aiOverrides.aiRangePolicy');
  });

  it('treats absent optional overrides as null (fall back to defaults)', () => {
    const slice = {
      aiVerticalEnabled: null,
      aiEngagementBoostEnabled: null,
      aiTickRateExperimentEnabled: null,
      aiRangePolicy: null,
    } as AiOverrideSlice;

    const sanitized = sanitizeAiOverrides(slice);

    expect(sanitized.aiSmoothingEnabled).toBeNull();
    expect(sanitized.aiHysteresisEnabled).toBeNull();
    expect(sanitized.aiVerticalDampingEnabled).toBeNull();
  });
});

describe('getEffectiveAIConfig with sanitized overrides', () => {
  it('reflects a valid provider slice', () => {
    setAiOverrideProvider(() => ({
      aiVerticalEnabled: false,
      aiEngagementBoostEnabled: true,
      aiTickRateExperimentEnabled: true,
      aiRangePolicy: 'stable',
      aiSmoothingEnabled: false,
      aiHysteresisEnabled: true,
      aiVerticalDampingEnabled: false,
    }));

    const config = getEffectiveAIConfig();

    expect(config.verticalEnabled).toBe(false);
    expect(config.engagementBoostEnabled).toBe(true);
    expect(config.tickRateHzExperiment).toBe(true);
    expect(config.rangePolicy).toBe('stable');
    expect(config.smoothingEnabled).toBe(false);
    expect(config.hysteresisEnabled).toBe(true);
    expect(config.verticalDampingEnabled).toBe(false);
  });

  it('falls back to config defaults for a wrong-typed provider slice without throwing', () => {
    setAiOverrideProvider(() => ({ aiVerticalEnabled: 'yes' }) as unknown as AiOverrideSlice);

    expect(() => getEffectiveAIConfig()).not.toThrow();
    expect(getEffectiveAIConfig().verticalEnabled).toBe(AI_CONFIG.verticalEnabled);
  });
});
