import { afterEach, describe, expect, it } from 'vite-plus/test';
import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { DebugDrawer, SettingsDrawer } from '../../src/components/HudToggleDrawer.js';
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

  it('keeps only one drawer open at a time across SettingsDrawer and DebugDrawer', () => {
    render(
      <>
        <SettingsDrawer />
        <DebugDrawer />
      </>,
    );

    const settingsTrigger = screen.getByRole('button', { name: 'Simulation settings' });
    const debugTrigger = screen.getByRole('button', { name: 'Debug overlays' });

    fireEvent.click(settingsTrigger);
    expect(settingsTrigger.getAttribute('aria-expanded')).toBe('true');
    expect(debugTrigger.getAttribute('aria-expanded')).toBe('false');
    expect(screen.getByRole('switch', { name: 'Postprocessing' })).toBeDefined();

    fireEvent.click(debugTrigger);
    expect(settingsTrigger.getAttribute('aria-expanded')).toBe('false');
    expect(debugTrigger.getAttribute('aria-expanded')).toBe('true');
    expect(screen.queryByRole('switch', { name: 'Postprocessing' })).toBeNull();
    expect(screen.getByRole('switch', { name: 'AI Debug' })).toBeDefined();
  });

  it('closes an open drawer on click outside', () => {
    render(
      <div>
        <div data-testid="outside-area">Outside</div>
        <SettingsDrawer />
      </div>,
    );

    const settingsTrigger = screen.getByRole('button', { name: 'Simulation settings' });
    fireEvent.click(settingsTrigger);
    expect(settingsTrigger.getAttribute('aria-expanded')).toBe('true');

    fireEvent.pointerDown(screen.getByTestId('outside-area'));
    expect(settingsTrigger.getAttribute('aria-expanded')).toBe('false');
    expect(screen.queryByRole('switch', { name: 'Postprocessing' })).toBeNull();
  });

  it('closes an open drawer on Escape from document and returns focus to its toggle button', () => {
    render(<SettingsDrawer />);

    const settingsTrigger = screen.getByRole('button', { name: 'Simulation settings' });
    fireEvent.click(settingsTrigger);
    expect(settingsTrigger.getAttribute('aria-expanded')).toBe('true');

    const outsideButton = document.createElement('button');
    document.body.appendChild(outsideButton);
    outsideButton.focus();
    expect(document.activeElement).toBe(outsideButton);

    try {
      fireEvent.keyDown(document, { key: 'Escape' });
      expect(settingsTrigger.getAttribute('aria-expanded')).toBe('false');
      expect(screen.queryByRole('switch', { name: 'Postprocessing' })).toBeNull();
      expect(document.activeElement).toBe(settingsTrigger);
    } finally {
      outsideButton.remove();
    }
  });
});
