import { describe, expect, it, afterEach } from 'vite-plus/test';
import {
  getShieldVisuals,
  SHIELD_TUNING,
  SHIELD_VISUALS,
  SHIELD_VISUAL_DEFAULTS,
} from '../../src/config/shields.js';
import { createShieldHexShaderMaterial } from '../../src/renderer/materialRegistry.js';

const originalFighter = structuredClone(SHIELD_VISUALS.fighter);
const originalDepthTest = SHIELD_TUNING.depthTest;

afterEach(() => {
  SHIELD_VISUALS.fighter = structuredClone(originalFighter);
  SHIELD_TUNING.depthTest = originalDepthTest;
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

describe('SHIELD_TUNING.depthTest occlusion toggle', () => {
  it('defaults to enabled so shields are occluded by nearer opaque geometry', () => {
    expect(SHIELD_TUNING.depthTest).toBe(true);
  });

  it('drives the shield hex material depthTest without code changes', () => {
    SHIELD_TUNING.depthTest = true;
    const enabled = createShieldHexShaderMaterial('fighter', 'blue');
    expect(enabled.depthTest).toBe(true);
    expect(enabled.depthWrite).toBe(false);
    enabled.dispose();

    SHIELD_TUNING.depthTest = false;
    const disabled = createShieldHexShaderMaterial('fighter', 'blue');
    expect(disabled.depthTest).toBe(false);
    expect(disabled.depthWrite).toBe(false);
    disabled.dispose();
  });
});
