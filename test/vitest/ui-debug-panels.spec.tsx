import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { DebugDrawer } from '../../src/components/HudToggleDrawer.js';
import { useUiStore } from '../../src/game/uiStore.js';

const DEFAULT_FLAGS = (() => {
  const snapshot = useUiStore.getState();
  return {
    postprocessingEnabled: snapshot.postprocessingEnabled,
    hudHealthBarsEnabled: snapshot.hudHealthBarsEnabled,
    aiV2Enabled: snapshot.aiV2Enabled,
    aiDebugEnabled: snapshot.aiDebugEnabled,
    explosionDebugEnabled: snapshot.explosionDebugEnabled,
    perfMonitorEnabled: snapshot.perfMonitorEnabled,
    perfMonitorPosition: { ...snapshot.perfMonitorPosition },
  };
})();

beforeEach(() => {
  useUiStore.setState(DEFAULT_FLAGS);
});

afterEach(() => {
  cleanup();
  useUiStore.setState(DEFAULT_FLAGS);
});

describe('DebugDrawer', () => {
  it('toggles AI Debug and Explosion Debug flags', () => {
    render(<DebugDrawer />);
    const trigger = screen.getByRole('button', { name: 'Debug overlays' });
    fireEvent.click(trigger);

    const aiSwitch = screen.getByRole('switch', { name: 'AI Debug' });
    expect(aiSwitch).toBeDefined();
    fireEvent.click(aiSwitch);
    expect(useUiStore.getState().aiDebugEnabled).toBe(true);

    const explosionSwitch = screen.getByRole('switch', { name: 'Explosion Debug' });
    fireEvent.click(explosionSwitch);
    expect(useUiStore.getState().explosionDebugEnabled).toBe(true);
  });

  it('toggles the perf monitor flag', () => {
    render(<DebugDrawer />);
    const trigger = screen.getByRole('button', { name: 'Debug overlays' });
    fireEvent.click(trigger);

    const perfSwitch = screen.getByRole('switch', { name: 'Perf Monitor' });
    expect(perfSwitch.getAttribute('aria-checked')).toBe('false');
    fireEvent.click(perfSwitch);
    expect(useUiStore.getState().perfMonitorEnabled).toBe(true);
  });

  it('disables AI Debug toggle when AI V2 is off', () => {
    useUiStore.setState({ aiV2Enabled: false, aiDebugEnabled: false });
    render(<DebugDrawer />);
    const trigger = screen.getByRole('button', { name: 'Debug overlays' });
    fireEvent.click(trigger);

    const aiSwitch = screen.getByRole('switch', { name: 'AI Debug' }) as HTMLButtonElement;
    expect(aiSwitch.getAttribute('aria-checked')).toBe('false');
    expect(aiSwitch.disabled).toBe(true);
  });
});
