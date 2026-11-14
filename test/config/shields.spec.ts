import { describe, expect, it, afterEach } from 'vite-plus/test';
import {
  getShieldVisuals,
  SHIELD_TUNING,
  SHIELD_VISUALS,
  SHIELD_VISUAL_DEFAULTS,
} from '../../src/config/shields.js';
import { createShieldHexShaderMaterial } from '../../src/renderer/materialRegistry.js';
import { buildShieldHexFragmentShader } from '../../src/renderer/shields/shieldHexShaders.js';
import {
  resolveShieldGeometrySegments,
  SHIELD_FAR_SEGMENTS,
  SHIELD_LOD_FAR_DISTANCE,
  SHIELD_LOD_HYSTERESIS,
  SHIELD_LOD_MID_DISTANCE,
  SHIELD_MID_SEGMENTS,
} from '../../src/components/ship/shieldUtils.js';
import { getSharedShieldGeometry } from '../../src/components/ship/ShipShield.js';

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

describe('Shield geometry LOD and polar UV projection', () => {
  it('reduces default sphere segment count below the legacy 128-segment tessellation', () => {
    expect(SHIELD_VISUAL_DEFAULTS.geometrySegments).toBe(48);
  });

  it('selects near/mid/far shield segments with distance hysteresis', () => {
    const maxSegments = 48;
    expect(resolveShieldGeometrySegments(100, maxSegments)).toBe(maxSegments);
    expect(resolveShieldGeometrySegments(SHIELD_LOD_MID_DISTANCE + 50, maxSegments)).toBe(
      SHIELD_MID_SEGMENTS,
    );
    expect(resolveShieldGeometrySegments(SHIELD_LOD_FAR_DISTANCE + 50, maxSegments)).toBe(
      SHIELD_FAR_SEGMENTS,
    );

    // Hysteresis prevents rapid toggling right at the mid-tier threshold.
    expect(
      resolveShieldGeometrySegments(
        SHIELD_LOD_MID_DISTANCE - SHIELD_LOD_HYSTERESIS * 0.5,
        maxSegments,
        SHIELD_MID_SEGMENTS,
      ),
    ).toBe(SHIELD_MID_SEGMENTS);
    expect(
      resolveShieldGeometrySegments(
        SHIELD_LOD_MID_DISTANCE - SHIELD_LOD_HYSTERESIS - 5,
        maxSegments,
        SHIELD_MID_SEGMENTS,
      ),
    ).toBe(maxSegments);
  });

  it('caches shared SphereGeometry instances per segment tier', () => {
    const midA = getSharedShieldGeometry(SHIELD_MID_SEGMENTS);
    const midB = getSharedShieldGeometry(SHIELD_MID_SEGMENTS);
    const far = getSharedShieldGeometry(SHIELD_FAR_SEGMENTS);

    expect(midA).toBe(midB);
    expect(midA.parameters.widthSegments).toBe(SHIELD_MID_SEGMENTS);
    expect(midA.parameters.heightSegments).toBe(SHIELD_MID_SEGMENTS);
    expect(far).not.toBe(midA);
    expect(far.parameters.widthSegments).toBe(SHIELD_FAR_SEGMENTS);
  });

  it('uses equal-angle triplanar cube-sphere projection instead of equirectangular polar pinching', () => {
    const shader = buildShieldHexFragmentShader();
    expect(shader).toContain('evalHexFace');
    expect(shader).toContain('atan(');
    expect(shader).not.toContain('acos(clamp(N.y');
  });
});
