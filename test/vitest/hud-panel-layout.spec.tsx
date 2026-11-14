import fs from 'node:fs';
import path from 'node:path';
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';
import { cleanup, render } from '@testing-library/react';
import { useUiStore } from '../../src/app/uiStore.js';
import { ExplosionDebugOverlay } from '../../src/components/ExplosionDebugOverlay.js';
import * as GameContext from '../../src/app/context.js';
import type { GameState } from '../../src/types/index.js';

interface Rect {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

function fromXY(x: number, y: number, width: number, height: number): Rect {
  return { left: x, top: y, right: x + width, bottom: y + height };
}

function rectsOverlap(a: Rect, b: Rect): boolean {
  return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
}

const DEFAULT_SNAPSHOT = (() => {
  const s = useUiStore.getState();
  return {
    explosionDebugEnabled: s.explosionDebugEnabled,
    perfMonitorPosition: { ...s.perfMonitorPosition },
    progressionPanelPosition: { ...s.progressionPanelPosition },
  };
})();

afterEach(() => {
  cleanup();
  useUiStore.setState({
    explosionDebugEnabled: DEFAULT_SNAPSHOT.explosionDebugEnabled,
    perfMonitorPosition: { ...DEFAULT_SNAPSHOT.perfMonitorPosition },
    progressionPanelPosition: { ...DEFAULT_SNAPSHOT.progressionPanelPosition },
  });
});

describe('HUD panel non-overlapping defaults & CSS layout', () => {
  it('places default perfMonitorPosition and progressionPanelPosition without overlapping controls, ai-debug, hud-panel, or each other on 1280x720', () => {
    const { perfMonitorPosition, progressionPanelPosition } = useUiStore.getState();

    // Canonical desktop regions matching src/styles/*.css at 1280x720:
    const controlsBar = fromXY(16, 16, 499, 56);
    const aiDebugOverlay = fromXY(16, 84, 402, 420);
    const hudPanel = fromXY(1280 - 24 - 370, 24, 370, 320);
    const explosionDebug = fromXY(1280 - 16 - 300, 720 - 16 - 240, 300, 240);

    const perfMonitor = fromXY(perfMonitorPosition.x, perfMonitorPosition.y, 320, 240);
    const progressionPanel = fromXY(
      progressionPanelPosition.x,
      progressionPanelPosition.y,
      380,
      420,
    );

    expect(rectsOverlap(perfMonitor, controlsBar)).toBe(false);
    expect(rectsOverlap(perfMonitor, aiDebugOverlay)).toBe(false);
    expect(rectsOverlap(perfMonitor, hudPanel)).toBe(false);

    expect(rectsOverlap(progressionPanel, controlsBar)).toBe(false);
    expect(rectsOverlap(progressionPanel, aiDebugOverlay)).toBe(false);
    expect(rectsOverlap(progressionPanel, hudPanel)).toBe(false);
    expect(rectsOverlap(progressionPanel, explosionDebug)).toBe(false);
    expect(rectsOverlap(progressionPanel, perfMonitor)).toBe(false);
  });

  it('anchors ExplosionDebugOverlay to bottom-right so it does not cover .hud-panel', () => {
    useUiStore.setState({ explosionDebugEnabled: true });
    const mockState = { explosions: [] } as unknown as GameState;
    const spy = vi.spyOn(GameContext, 'useOptionalGameState').mockReturnValue(mockState);

    try {
      render(<ExplosionDebugOverlay />);

      const overlay = document.querySelector('.explosion-debug-overlay') as HTMLElement | null;
      expect(overlay).not.toBeNull();
      expect(overlay!.style.bottom).toBe('16px');
      expect(overlay!.style.right).toBe('16px');
      expect(overlay!.style.top).toBe('');
    } finally {
      spy.mockRestore();
    }
  });

  it('keeps CSS layout fixes and consolidated progression styles in place', () => {
    const root = process.cwd();
    expect(fs.existsSync(path.join(root, 'src/components/progression-panel.css'))).toBe(false);

    const aiDebugCss = fs.readFileSync(path.join(root, 'src/styles/ai-debug.css'), 'utf8');
    expect(aiDebugCss).toMatch(/top:\s*84px/);

    const controlsCss = fs.readFileSync(path.join(root, 'src/styles/controls.css'), 'utf8');
    const buttonHoverMatches = controlsCss.match(/\.controls-bar button:hover/g) ?? [];
    expect(buttonHoverMatches).toHaveLength(1);

    const hudDrawerCss = fs.readFileSync(path.join(root, 'src/styles/hud-drawer.css'), 'utf8');
    expect(hudDrawerCss).toMatch(/\.hud-panel__actions\s*\{[^}]*flex-direction:\s*row/s);

    const progressionCss = fs.readFileSync(path.join(root, 'src/styles/progression.css'), 'utf8');
    expect(progressionCss).toContain('var(--panel-bg)');
    expect(progressionCss).toContain('var(--panel-border)');
    expect(progressionCss).toContain('.progression-panel__empty');
  });
});
