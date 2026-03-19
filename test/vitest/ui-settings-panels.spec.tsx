import { afterEach, describe, expect, it, vi } from 'vite-plus/test';
import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { SettingsDrawer } from '../../src/components/HudToggleDrawer.js';
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

afterEach(() => {
  cleanup();
  useUiStore.setState(DEFAULT_FLAGS);
});

describe('SettingsDrawer', () => {
  it('toggles the drawer visibility via the gear button', () => {
    render(<SettingsDrawer />);
    const trigger = screen.getByRole('button', { name: 'Simulation settings' });
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    expect(screen.queryByRole('switch', { name: 'Postprocessing' })).toBeNull();

    fireEvent.click(trigger);

    expect(trigger.getAttribute('aria-expanded')).toBe('true');
    expect(screen.getByRole('switch', { name: 'Postprocessing' })).toBeDefined();
  });

  it('updates UI store flags when toggles are clicked', () => {
    render(<SettingsDrawer />);
    const trigger = screen.getByRole('button', { name: 'Simulation settings' });
    fireEvent.click(trigger);

    const postprocessingSwitch = screen.getByRole('switch', { name: 'Postprocessing' });
    expect(postprocessingSwitch.getAttribute('aria-checked')).toBe('true');
    fireEvent.click(postprocessingSwitch);
    expect(useUiStore.getState().postprocessingEnabled).toBe(false);

    const hudBarsSwitch = screen.getByRole('switch', { name: 'HUD Bars' });
    fireEvent.click(hudBarsSwitch);
    expect(useUiStore.getState().hudHealthBarsEnabled).toBe(true);

    const aiSwitch = screen.getByRole('switch', { name: 'AI V2' });
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(aiSwitch.getAttribute('aria-checked')).toBe('true');
    fireEvent.click(aiSwitch);
    expect(useUiStore.getState().aiV2Enabled).toBe(true);
    expect(aiSwitch.getAttribute('aria-checked')).toBe('true');
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });
});
