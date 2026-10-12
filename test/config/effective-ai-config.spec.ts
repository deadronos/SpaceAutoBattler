import { afterEach, describe, expect, it } from 'vite-plus/test';
import { AI_CONFIG, getEffectiveAIConfig } from '../../src/game/config.js';

interface UiSlice {
  aiVerticalEnabled: boolean | null | undefined;
  aiEngagementBoostEnabled: boolean | null | undefined;
  aiTickRateExperimentEnabled: boolean | null | undefined;
  aiRangePolicy: string | null | undefined;
  aiSmoothingEnabled?: boolean | null | undefined;
  aiHysteresisEnabled?: boolean | null | undefined;
  aiVerticalDampingEnabled?: boolean | null | undefined;
}

function installStore(initial: UiSlice): (next: UiSlice) => void {
  let slice = initial;
  (globalThis as { __spaceAutobattlerUiStore?: unknown }).__spaceAutobattlerUiStore = {
    getState: () => slice,
  };
  return (next: UiSlice) => {
    slice = next;
  };
}

afterEach(() => {
  delete (globalThis as { __spaceAutobattlerUiStore?: unknown }).__spaceAutobattlerUiStore;
});

describe('getEffectiveAIConfig', () => {
  it('returns a stable reference while UI flags are unchanged, and a new one when they change', () => {
    const flags: UiSlice = {
      aiVerticalEnabled: true,
      aiEngagementBoostEnabled: true,
      aiTickRateExperimentEnabled: false,
      aiRangePolicy: 'default',
    };
    const setFlags = installStore(flags);

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
    installStore(flags);

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
    const setFlags = installStore(flags);
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
    (globalThis as { __spaceAutobattlerUiStore?: unknown }).__spaceAutobattlerUiStore = {
      getState: () => {
        throw new Error('boom');
      },
    };
    expect(getEffectiveAIConfig()).toBe(AI_CONFIG);
  });
});
