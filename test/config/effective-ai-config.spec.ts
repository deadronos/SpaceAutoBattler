import { afterEach, describe, expect, it } from 'vite-plus/test';
import {
  AI_CONFIG,
  getEffectiveAIConfig,
  setAiOverrideProvider,
  type AiOverrideSlice,
} from '../../src/game/config.js';

type UiSlice = AiOverrideSlice;

function installProvider(initial: UiSlice): (next: UiSlice) => void {
  let slice = initial;
  setAiOverrideProvider(() => slice);
  return (next: UiSlice) => {
    slice = next;
  };
}

afterEach(() => {
  setAiOverrideProvider(null);
});

describe('getEffectiveAIConfig', () => {
  it('returns a stable reference while UI flags are unchanged, and a new one when they change', () => {
    const flags: UiSlice = {
      aiVerticalEnabled: true,
      aiEngagementBoostEnabled: true,
      aiTickRateExperimentEnabled: false,
      aiRangePolicy: 'default',
    };
    const setFlags = installProvider(flags);

    const first = getEffectiveAIConfig();
    const second = getEffectiveAIConfig();
    expect(second).toBe(first);
    expect(first.verticalEnabled).toBe(true);

    setFlags({ ...flags, aiVerticalEnabled: false });
    const third = getEffectiveAIConfig();
    expect(third).not.toBe(first);
    expect(third.verticalEnabled).toBe(false);
  });

  it('returns the same reference across consecutive calls with an unchanged flag tuple', () => {
    const flags: UiSlice = {
      aiVerticalEnabled: true,
      aiEngagementBoostEnabled: true,
      aiTickRateExperimentEnabled: false,
      aiRangePolicy: 'default',
      aiSmoothingEnabled: true,
      aiHysteresisEnabled: true,
      aiVerticalDampingEnabled: true,
    };
    installProvider(flags);

    const first = getEffectiveAIConfig();
    const second = getEffectiveAIConfig();
    const third = getEffectiveAIConfig();
    expect(second).toBe(first);
    expect(third).toBe(first);
  });

  it('recomputes a new object when any single flag changes and reverts without throwing', () => {
    const flags: UiSlice = {
      aiVerticalEnabled: true,
      aiEngagementBoostEnabled: true,
      aiTickRateExperimentEnabled: false,
      aiRangePolicy: 'default',
      aiSmoothingEnabled: true,
      aiHysteresisEnabled: true,
      aiVerticalDampingEnabled: true,
    };
    const setFlags = installProvider(flags);
    const baseline = getEffectiveAIConfig();

    const mutations: Array<{
      patch: Partial<UiSlice>;
      configKey:
        | 'verticalEnabled'
        | 'engagementBoostEnabled'
        | 'tickRateHzExperiment'
        | 'rangePolicy'
        | 'smoothingEnabled'
        | 'hysteresisEnabled'
        | 'verticalDampingEnabled';
      expected: boolean | string;
    }> = [
      { patch: { aiVerticalEnabled: false }, configKey: 'verticalEnabled', expected: false },
      {
        patch: { aiEngagementBoostEnabled: false },
        configKey: 'engagementBoostEnabled',
        expected: false,
      },
      {
        patch: { aiTickRateExperimentEnabled: true },
        configKey: 'tickRateHzExperiment',
        expected: true,
      },
      { patch: { aiRangePolicy: 'v0.1.1-exp' }, configKey: 'rangePolicy', expected: 'v0.1.1-exp' },
      { patch: { aiSmoothingEnabled: false }, configKey: 'smoothingEnabled', expected: false },
      { patch: { aiHysteresisEnabled: false }, configKey: 'hysteresisEnabled', expected: false },
      {
        patch: { aiVerticalDampingEnabled: false },
        configKey: 'verticalDampingEnabled',
        expected: false,
      },
    ];

    for (const { patch, configKey, expected } of mutations) {
      setFlags({ ...flags, ...patch });
      const changed = getEffectiveAIConfig();
      expect(changed).not.toBe(baseline);
      expect(changed[configKey]).toBe(expected);

      setFlags({ ...flags });
      expect(() => getEffectiveAIConfig()).not.toThrow();
    }
  });

  it('falls back to AI_CONFIG when the UI store throws', () => {
    setAiOverrideProvider(() => {
      throw new Error('boom');
    });
    expect(getEffectiveAIConfig()).toBe(AI_CONFIG);
  });
});
