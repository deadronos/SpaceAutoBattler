import { afterEach, describe, expect, it } from 'vite-plus/test';
import { getEffectiveAIConfig } from '../../src/game/config.js';

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
});
