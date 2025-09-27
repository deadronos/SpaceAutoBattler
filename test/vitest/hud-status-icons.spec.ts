import { describe, expect, it } from 'vitest';
import { STATUS_EFFECT_FALLBACK, STATUS_EFFECT_REGISTRY } from '../../src/config/hudHealth.js';
import { layoutOverlays } from '../../src/components/HudHealthLayer.js';
import type { ShipHudOverlaySnapshot } from '../../src/renderer/hudOverlayStore.js';

describe('HUD status effect registry', () => {
  it('provides tooltip metadata for known effects', () => {
    const jammed = STATUS_EFFECT_REGISTRY.jammed;
    expect(jammed).toBeDefined();
    expect(jammed.label).toContain('jammed');
  });

  it('falls back to the default metadata when an effect is missing', () => {
    const overlay: ShipHudOverlaySnapshot = {
      id: 1,
      team: 'blue',
      hull: 'fighter',
      x: 500,
      y: 400,
      visible: true,
      healthRatio: 1,
      shieldRatio: 1,
      statusEffects: ['unknown-effect' as never],
      seed: 10,
      worldPosition: { x: 0, y: 0, z: 0 },
    };
    const [result] = layoutOverlays([overlay], {
      viewport: { width: 1280, height: 720 },
      reserved: [],
      config: {
        ...DEFAULT_CONFIG,
      },
    });
    expect(result.effects[0].definition).toEqual(STATUS_EFFECT_FALLBACK);
  });

  it('caps badges to two and aggregates overflow count', () => {
    const overlay: ShipHudOverlaySnapshot = {
      id: 3,
      team: 'red',
      hull: 'destroyer',
      x: 640,
      y: 360,
      visible: true,
      healthRatio: 0.3,
      shieldRatio: 0,
      statusEffects: ['jammed', 'shield-down', 'hacked'],
      seed: 5,
      worldPosition: { x: 0, y: 0, z: 0 },
    };
    const [result] = layoutOverlays([overlay], {
      viewport: { width: 1280, height: 720 },
      reserved: [],
      config: DEFAULT_CONFIG,
    });
    expect(result.effects.length).toBe(2);
    expect(result.overflowCount).toBe(1);
  });
});

const DEFAULT_CONFIG = {
  shieldColor: '#4cc2ff',
  healthColor: '#3bd675',
  barWidth: 80,
  barHeight: 6,
  gap: 4,
  animationDurationMs: 150,
  statusBadgeSize: 16,
  statusBadgeGap: 12,
  // Opacity tunables - kept in sync with DEFAULT_HUD_HEALTH_OVERLAY_CONFIG defaults
  overlayOpacity: 0.86,
  barBgOpacity: 0.9,
  fillOpacity: 1,
  statusBadgeOpacity: 0.95,
  // HUD offset defaults - no offset
  hudOffsetX: 0,
  hudOffsetY: 0,
};
