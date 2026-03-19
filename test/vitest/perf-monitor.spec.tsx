import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test';

vi.mock('r3f-perf', async () => {
  const React = await import('react');
  return {
    Perf: ({ className }: { className?: string }) =>
      React.createElement('div', { className, 'data-mock-perf': 'true' }),
  };
});

import React from 'react';
import { act, cleanup, render, waitFor } from '@testing-library/react';
import { PerfMonitorOverlay } from '../../src/components/PerfMonitorOverlay.js';
import { useUiStore } from '../../src/game/uiStore.js';

const PANEL_CLASS = 'hud-perf-monitor';

const DEFAULT_STATE = (() => {
  const snapshot = useUiStore.getState();
  return {
    perfMonitorEnabled: snapshot.perfMonitorEnabled,
    perfMonitorPosition: { ...snapshot.perfMonitorPosition },
  };
})();

function resetStore(): void {
  useUiStore.setState({
    perfMonitorEnabled: DEFAULT_STATE.perfMonitorEnabled,
    perfMonitorPosition: { ...DEFAULT_STATE.perfMonitorPosition },
  });
}

beforeEach(() => {
  resetStore();
});

afterEach(() => {
  cleanup();
  resetStore();
});

describe('PerfMonitorOverlay', () => {
  it('mounts when enabled, supports dragging, and restores position on re-enable', async () => {
    act(() => {
      useUiStore.getState().setPerfMonitorEnabled(true);
    });

    render(<PerfMonitorOverlay />);

    await waitFor(() => {
      expect(document.querySelector(`.${PANEL_CLASS}`)).not.toBeNull();
    });

    const panel = document.querySelector(`.${PANEL_CLASS}`) as HTMLDivElement;
    Object.defineProperty(panel, 'offsetWidth', { value: 320, configurable: true });
    Object.defineProperty(panel, 'offsetHeight', { value: 240, configurable: true });
    const initialPosition = useUiStore.getState().perfMonitorPosition;
    expect(initialPosition).toEqual(DEFAULT_STATE.perfMonitorPosition);

    act(() => {
      panel.dispatchEvent(new PointerEvent('pointerdown', { clientX: 40, clientY: 40, button: 0 }));
      window.dispatchEvent(
        new PointerEvent('pointermove', { clientX: 140, clientY: 150, buttons: 1 }),
      );
      window.dispatchEvent(
        new PointerEvent('pointerup', { clientX: 140, clientY: 150, button: 0 }),
      );
    });

    const updatedPosition = useUiStore.getState().perfMonitorPosition;
    expect(updatedPosition.x).toBeGreaterThan(initialPosition.x);
    expect(updatedPosition.y).toBeGreaterThan(initialPosition.y);

    act(() => {
      useUiStore.getState().setPerfMonitorEnabled(false);
    });

    await waitFor(() => {
      expect(document.querySelector(`.${PANEL_CLASS}`)).toBeNull();
    });

    act(() => {
      useUiStore.getState().setPerfMonitorEnabled(true);
    });

    await waitFor(() => {
      expect(document.querySelector(`.${PANEL_CLASS}`)).not.toBeNull();
    });

    const restoredPosition = useUiStore.getState().perfMonitorPosition;
    expect(restoredPosition).toEqual(updatedPosition);
  });
});
