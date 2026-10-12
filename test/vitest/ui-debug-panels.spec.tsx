import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test';
import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { DebugDrawer } from '../../src/components/HudToggleDrawer.js';
import { ErrorCountsPanel } from '../../src/debug/ErrorCountsPanel.js';
import { useUiStore } from '../../src/app/uiStore.js';

// Force the error panel to render a non-zero count so the collapsed header is present.
vi.mock('../../src/utils/errorReporting.js', async (importOriginal) => {
  const actual = await importOriginal<any>();
  return {
    ...actual,
    getTotalErrorCount: () => 3,
    getErrorCounts: () => ({ ...actual.getErrorCounts(), [actual.ErrorCategory.Physics]: 3 }),
    getRecentErrors: () => [],
  };
});

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

describe('ErrorCountsPanel', () => {
  it('expands the error details with Space and exposes aria-expanded', () => {
    render(<ErrorCountsPanel />);

    const header = screen.getByRole('button');
    expect(header.getAttribute('aria-expanded')).toBe('false');

    fireEvent.keyDown(header, { key: ' ' });
    expect(header.getAttribute('aria-expanded')).toBe('true');
    expect(screen.getByText('physics')).toBeDefined();
  });
});
