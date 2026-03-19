import { describe, expect, it } from 'vite-plus/test';
import { useUiStore } from '../../src/game/uiStore.js';
import { AI_CONFIG } from '../../src/game/config.js';

describe('uiStore defaults', () => {
  it('enables postprocessing by default', () => {
    const snapshot = useUiStore.getState();
    expect(snapshot.postprocessingEnabled).toBe(true);
  });

  it('respects AI config default and defaults to enabled', () => {
    const snapshot = useUiStore.getState();
    expect(snapshot.aiV2Enabled).toBe(AI_CONFIG.v2Enabled);
    expect(snapshot.aiV2Enabled).toBe(true);
  });
});
