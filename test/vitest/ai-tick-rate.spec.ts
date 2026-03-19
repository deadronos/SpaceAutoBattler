import { afterEach, describe, expect, it } from 'vite-plus/test';
import { AI_CONFIG } from '../../src/game/config.js';
import { createGameState, disposeGameState } from '../../src/game/state.js';
import { updateGame } from '../../src/game/systems.js';

const ORIGINAL_CONFIG = {
  tickRateHz: AI_CONFIG.tickRateHz,
  tickRateHzExperiment: AI_CONFIG.tickRateHzExperiment,
};

afterEach(() => {
  AI_CONFIG.tickRateHzExperiment = ORIGINAL_CONFIG.tickRateHzExperiment;
  AI_CONFIG.tickRateHz = ORIGINAL_CONFIG.tickRateHz;
});

describe('AI tick rate experiment', () => {
  it('propagates tick interval to game state when toggled', async () => {
    AI_CONFIG.tickRateHzExperiment = false;
    AI_CONFIG.tickRateHz = AI_CONFIG.tickRateHzBase;
    const baselineState = await createGameState();
    try {
      expect(baselineState.ai.tickInterval).toBeCloseTo(1 / AI_CONFIG.tickRateHzBase, 6);
    } finally {
      disposeGameState(baselineState);
    }

    AI_CONFIG.tickRateHzExperiment = true;
    AI_CONFIG.tickRateHz = AI_CONFIG.tickRateHzExperimental;
    const experimentState = await createGameState();
    try {
      expect(experimentState.ai.tickInterval).toBeCloseTo(1 / AI_CONFIG.tickRateHzExperimental, 6);
    } finally {
      disposeGameState(experimentState);
    }
  });

  it('processes more decision ticks over the same duration when experiment is enabled', async () => {
    const expectedRatio = AI_CONFIG.tickRateHzExperimental / AI_CONFIG.tickRateHzBase;
    const baselineTicks = await measureTickCount(false);
    const experimentTicks = await measureTickCount(true);
    const actualRatio = experimentTicks / baselineTicks;

    expect(experimentTicks).toBeGreaterThan(baselineTicks);
    expect(actualRatio).toBeGreaterThanOrEqual(expectedRatio * 0.95);
  });
});

async function measureTickCount(experimentEnabled: boolean, durationSeconds = 6): Promise<number> {
  AI_CONFIG.tickRateHzExperiment = experimentEnabled;
  AI_CONFIG.tickRateHz = experimentEnabled
    ? AI_CONFIG.tickRateHzExperimental
    : AI_CONFIG.tickRateHzBase;

  const state = await createGameState();
  try {
    state.ai.enabled = true;
    state.ai.tickInterval = 1 / AI_CONFIG.tickRateHz;
    state.ai.accumulator = 0;
    state.ai.tickIndex = 0;

    const dt = 1 / 240;
    const steps = Math.ceil(durationSeconds / dt);
    for (let i = 0; i < steps; i += 1) {
      updateGame(state, dt);
    }

    return state.ai.tickIndex;
  } finally {
    disposeGameState(state);
  }
}
