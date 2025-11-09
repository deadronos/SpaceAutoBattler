import { describe, expect, it } from 'vitest';

describe('renderer config facade', () => {
  it('re-exports motion, shield, effects, and postprocessing symbols', async () => {
    const facade = await import('../../src/config/renderer.js');
    const keys = Object.keys(facade).sort();
    expect(keys).toMatchInlineSnapshot(`[
      "HULL_TINT",
      "PARTICLE_TRAILS_CONFIG",
      "POSTPROCESSING_CONFIG",
      "RENDERER_MOTION_DEFAULTS",
      "RENDERER_VISUAL_CONFIG",
      "SHIELD_RIPPLE_TUNING",
      "SHIELD_TUNING",
      "SHIELD_VISUALS",
      "SHIELD_VISUAL_DEFAULTS",
      "TEAM_COLORS",
      "THRUSTER_GLOW_CONFIG",
      "getShieldVisuals",
      "resolveRendererMotionConfig",
      "setGlobalShieldMaterial",
    ]`);
  });
});
