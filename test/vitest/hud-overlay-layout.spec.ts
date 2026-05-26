import { describe, expect, it } from 'vite-plus/test';
import { layoutOverlays } from '../../src/components/HudHealthLayer.js';
import { DEFAULT_HUD_HEALTH_OVERLAY_CONFIG } from '../../src/config/hudHealth.js';
import type { ShipHudOverlaySnapshot } from '../../src/renderer/hudOverlayStore.js';

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

  it('suppresses overlays when they would overlap the bottom margin', () => {
    const overlay: ShipHudOverlaySnapshot = {
      id: 2,
      team: 'red',
      hull: 'frigate',
      x: 960,
      y: 1070,
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
