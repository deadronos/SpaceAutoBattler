import { describe, expect, it, afterEach } from 'vite-plus/test';
import {
  getShieldVisuals,
  SHIELD_VISUALS,
  SHIELD_VISUAL_DEFAULTS,
} from '../../src/config/shields.js';

const originalFighter = structuredClone(SHIELD_VISUALS.fighter);

afterEach(() => {
  SHIELD_VISUALS.fighter = structuredClone(originalFighter);
});

describe('getShieldVisuals', () => {
  it('falls back to defaults when overrides omit values', () => {
    SHIELD_VISUALS.fighter = {};

    const visuals = getShieldVisuals('fighter');

    expect(visuals.margin).toBe(SHIELD_VISUAL_DEFAULTS.margin);
    expect(visuals.hexScale).toBe(SHIELD_VISUAL_DEFAULTS.hexScale);
    expect(visuals.meshtransmission.thickness).toBe(
      SHIELD_VISUAL_DEFAULTS.meshtransmission.thickness,
    );
  });

  it('preserves explicit per-hull overrides', () => {
    SHIELD_VISUALS.fighter = {
      margin: 1.45,
      meshtransmission: {
        thickness: 0.9,
      },
    };

    const visuals = getShieldVisuals('fighter');

    expect(visuals.margin).toBe(1.45);
    expect(visuals.meshtransmission.thickness).toBe(0.9);
    expect(visuals.meshtransmission.clearcoat).toBe(
      SHIELD_VISUAL_DEFAULTS.meshtransmission.clearcoat,
    );
  });
});
