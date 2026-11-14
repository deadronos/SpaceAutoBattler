import { afterEach, describe, expect, it } from 'vite-plus/test';
import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { SettingsDrawer } from '../../src/components/HudToggleDrawer.js';
import { useUiStore } from '../../src/app/uiStore.js';

const DEFAULT_FLAGS = (() => {
  const snapshot = useUiStore.getState();
  return {
    postprocessingEnabled: snapshot.postprocessingEnabled,
    hudHealthBarsEnabled: snapshot.hudHealthBarsEnabled,
    cameraShakeEnabled: snapshot.cameraShakeEnabled,
    progressionPanelEnabled: snapshot.progressionPanelEnabled,
    aiV2Enabled: snapshot.aiV2Enabled,
    aiDebugEnabled: snapshot.aiDebugEnabled,
    explosionDebugEnabled: snapshot.explosionDebugEnabled,
    perfMonitorEnabled: snapshot.perfMonitorEnabled,
    perfMonitorPosition: { ...snapshot.perfMonitorPosition },
    qualityPreset: snapshot.qualityPreset,
    detectedQualityTier: snapshot.detectedQualityTier,
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

  it('omits the dead AI V2 toggle and updates UI store flags when toggles are clicked', () => {
    render(<SettingsDrawer />);
    const trigger = screen.getByRole('button', { name: 'Simulation settings' });
    fireEvent.click(trigger);

    expect(screen.queryByRole('switch', { name: 'AI V2' })).toBeNull();

    const postprocessingSwitch = screen.getByRole('switch', { name: 'Postprocessing' });
    expect(postprocessingSwitch.getAttribute('aria-checked')).toBe('true');
    fireEvent.click(postprocessingSwitch);
    expect(useUiStore.getState().postprocessingEnabled).toBe(false);

    const hudBarsSwitch = screen.getByRole('switch', { name: 'HUD Bars' });
    fireEvent.click(hudBarsSwitch);
    expect(useUiStore.getState().hudHealthBarsEnabled).toBe(true);

    const cameraShakeSwitch = screen.getByRole('switch', { name: 'Camera Shake' });
    expect(cameraShakeSwitch.getAttribute('aria-checked')).toBe('true');
    fireEvent.click(cameraShakeSwitch);
    expect(useUiStore.getState().cameraShakeEnabled).toBe(false);
  });
});
