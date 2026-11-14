import React from 'react';
import { act, cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test';
import { useUiStore } from '../../src/app/uiStore.js';
import { HudHealthLayer, layoutOverlays } from '../../src/components/HudHealthLayer.js';
import { DEFAULT_HUD_HEALTH_OVERLAY_CONFIG } from '../../src/config/hudHealth.js';
import {
  useHudOverlayStore,
  type ShipHudOverlaySnapshot,
} from '../../src/renderer/hudOverlayStore.js';

describe('HUD overlay layout manager', () => {
  it('offsets overlays away from reserved UI rectangles and screen edges', () => {
    const overlay: ShipHudOverlaySnapshot = {
      id: 1,
      team: 'blue',
      hull: 'fighter',
      x: 24,
      y: 24,
      visible: true,
      healthRatio: 0.5,
      shieldRatio: 0.5,
      statusEffects: [],
      seed: 1,
      worldPosition: { x: 0, y: 0, z: 0 },
    };
    const reserved = [
      { left: 0, top: 0, right: 220, bottom: 120, width: 220, height: 120 },
      { left: 1500, top: 0, right: 1920, bottom: 480, width: 420, height: 480 },
    ];
    const [result] = layoutOverlays([overlay], {
      viewport: { width: 1920, height: 1080 },
      reserved,
      config: DEFAULT_HUD_HEALTH_OVERLAY_CONFIG,
    });
    expect(result!.screen!.x).toBeGreaterThan(overlay.x);
    expect(result!.screen!.y).toBeGreaterThan(overlay.y);
    expect(result!.screen!.hidden).toBe(false);
  });

  it('places overlays above the ship center using negative default hudOffsetY', () => {
    expect(DEFAULT_HUD_HEALTH_OVERLAY_CONFIG.hudOffsetY).toBeLessThan(0);

    const overlay: ShipHudOverlaySnapshot = {
      id: 3,
      team: 'blue',
      hull: 'corvette',
      x: 960,
      y: 540,
      visible: true,
      healthRatio: 0.8,
      shieldRatio: 0.6,
      statusEffects: [],
      seed: 3,
      worldPosition: { x: 0, y: 0, z: 0 },
    };
    const [result] = layoutOverlays([overlay], {
      viewport: { width: 1920, height: 1080 },
      reserved: [],
      config: DEFAULT_HUD_HEALTH_OVERLAY_CONFIG,
    });
    expect(result!.screen.hidden).toBe(false);
    expect(result!.screen.x).toBe(overlay.x);
    expect(result!.screen.y).toBe(overlay.y + DEFAULT_HUD_HEALTH_OVERLAY_CONFIG.hudOffsetY);
    expect(result!.screen.y).toBeLessThan(overlay.y);
  });

  it('suppresses overlays when they would overlap the bottom margin', () => {
    const overlay: ShipHudOverlaySnapshot = {
      id: 2,
      team: 'red',
      hull: 'frigate',
      x: 960,
      y: 1095,
      visible: true,
      healthRatio: 0.4,
      shieldRatio: 0.2,
      statusEffects: ['jammed'],
      seed: 2,
      worldPosition: { x: 0, y: 0, z: 0 },
    };
    const [result] = layoutOverlays([overlay], {
      viewport: { width: 1920, height: 1080 },
      reserved: [],
      config: DEFAULT_HUD_HEALTH_OVERLAY_CONFIG,
    });
    expect(result!.screen.hidden).toBe(true);
  });
});

describe('HudHealthLayer ResizeObserver integration', () => {
  const originalResizeObserver = globalThis.ResizeObserver;
  const createdElements: HTMLElement[] = [];

  beforeEach(() => {
    useUiStore.setState({ hudHealthBarsEnabled: true });
    useHudOverlayStore.getState().setSnapshot(1, [], { width: 1280, height: 720 });
  });

  afterEach(() => {
    cleanup();
    globalThis.ResizeObserver = originalResizeObserver;
    for (const el of createdElements.splice(0)) {
      el.remove();
    }
    useUiStore.setState({ hudHealthBarsEnabled: false });
    useHudOverlayStore.getState().clear();
  });

  function createPanel(className: string, rect: DOMRect): HTMLElement {
    const el = document.createElement('div');
    el.className = className;
    el.getBoundingClientRect = () => rect;
    document.body.appendChild(el);
    createdElements.push(el);
    return el;
  }

  it('omits aria-live from .hud-health-layer when empty and when rendering overlays', () => {
    const { rerender } = render(React.createElement(HudHealthLayer));
    const emptyLayer = document.querySelector('.hud-health-layer');
    expect(emptyLayer).not.toBeNull();
    expect(emptyLayer?.getAttribute('aria-live')).toBeNull();

    act(() => {
      useHudOverlayStore.getState().setSnapshot(
        2,
        [
          {
            id: 10,
            team: 'blue',
            hull: 'fighter',
            x: 640,
            y: 360,
            visible: true,
            healthRatio: 0.8,
            shieldRatio: 0.5,
            statusEffects: [],
            seed: 42,
            worldPosition: { x: 0, y: 0, z: 0 },
          },
        ],
        { width: 1280, height: 720 },
      );
    });

    rerender(React.createElement(HudHealthLayer));
    const activeLayer = document.querySelector('.hud-health-layer');
    expect(activeLayer).not.toBeNull();
    expect(activeLayer?.getAttribute('aria-live')).toBeNull();
  });

  it('observes all panel selectors with ResizeObserver and recalculates layout on resize', () => {
    const observed: Element[] = [];
    const disconnect = vi.fn();
    let resizeCallback: ResizeObserverCallback | null = null;

    globalThis.ResizeObserver = class MockResizeObserver {
      constructor(cb: ResizeObserverCallback) {
        resizeCallback = cb;
      }
      observe(target: Element) {
        observed.push(target);
      }
      unobserve() {}
      disconnect() {
        disconnect();
      }
    } as unknown as typeof ResizeObserver;

    const controls = createPanel('controls-bar', new DOMRect(16, 16, 480, 56));
    const hud = createPanel('hud-panel', new DOMRect(886, 24, 370, 300));
    let aiRect = new DOMRect(16, 84, 402, 160);
    const aiDebug = createPanel('ai-debug-overlay', aiRect);
    aiDebug.getBoundingClientRect = () => aiRect;
    const progression = createPanel('progression-panel', new DOMRect(436, 272, 380, 200));
    const explosion = createPanel('explosion-debug-overlay', new DOMRect(964, 500, 300, 200));
    const perf = createPanel('hud-perf-monitor', new DOMRect(536, 16, 320, 100));

    act(() => {
      useHudOverlayStore.getState().setSnapshot(
        3,
        [
          {
            id: 11,
            team: 'red',
            hull: 'corvette',
            x: 200,
            y: 300,
            visible: true,
            healthRatio: 0.9,
            shieldRatio: 0.7,
            statusEffects: [],
            seed: 7,
            worldPosition: { x: 0, y: 0, z: 0 },
          },
        ],
        { width: 1280, height: 720 },
      );
    });

    const { unmount } = render(React.createElement(HudHealthLayer));

    expect(observed).toContain(controls);
    expect(observed).toContain(hud);
    expect(observed).toContain(aiDebug);
    expect(observed).toContain(progression);
    expect(observed).toContain(explosion);
    expect(observed).toContain(perf);

    const overlayBefore = document.querySelector('.ship-hud-overlay') as HTMLElement;
    expect(overlayBefore).not.toBeNull();
    const topBefore = parseFloat(overlayBefore.style.top);
    // Ship overlay at y=300 (+ hudOffsetY=50 => 350) is below aiDebug (bottom=244)
    expect(topBefore).toBe(300 + DEFAULT_HUD_HEALTH_OVERLAY_CONFIG.hudOffsetY);

    // Resize aiDebug taller so its bottom (84 + 280 = 364) now intersects the overlay
    aiRect = new DOMRect(16, 84, 402, 280);
    act(() => {
      resizeCallback?.([], {} as ResizeObserver);
    });

    const overlayAfter = document.querySelector('.ship-hud-overlay') as HTMLElement;
    const topAfter = parseFloat(overlayAfter.style.top);
    expect(topAfter).toBeGreaterThan(topBefore);
    expect(topAfter).toBeGreaterThanOrEqual(aiRect.bottom + 16);

    unmount();
    expect(disconnect).toHaveBeenCalledTimes(1);
  });
});
