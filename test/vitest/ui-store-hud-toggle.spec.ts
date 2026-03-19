import { afterEach, describe, expect, it } from 'vite-plus/test';
import { mirrorHudHealthBarsFlag, useUiStore } from '../../src/game/uiStore.js';
import type { GameState } from '../../src/types/index.js';

describe('UI store HUD health toggle', () => {
  const initialState = useUiStore.getState();

  afterEach(() => {
    useUiStore.setState(initialState, true);
  });

  it('toggles and sets HUD health bar state', () => {
    expect(useUiStore.getState().hudHealthBarsEnabled).toBe(false);
    useUiStore.getState().toggleHudHealthBars();
    expect(useUiStore.getState().hudHealthBarsEnabled).toBe(true);
    useUiStore.getState().setHudHealthBarsEnabled(false);
    expect(useUiStore.getState().hudHealthBarsEnabled).toBe(false);
  });

  it('mirrors the toggle state into the GameState uiFlags', () => {
    const stubState = { uiFlags: { hudHealthBars: false } } as unknown as GameState;
    useUiStore.getState().setHudHealthBarsEnabled(true);
    mirrorHudHealthBarsFlag(stubState, useUiStore.getState().hudHealthBarsEnabled);
    expect(stubState.uiFlags.hudHealthBars).toBe(true);
    mirrorHudHealthBarsFlag(stubState, false);
    expect(stubState.uiFlags.hudHealthBars).toBe(false);
  });
});
