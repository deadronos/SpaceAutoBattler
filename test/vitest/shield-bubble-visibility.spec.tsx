import { describe, expect, it } from 'vite-plus/test';
import fs from 'fs';
import path from 'path';
import { SHIELD_RENDER_ORDER } from '../../src/components/Ship.js';
import { createShieldHexShaderMaterial } from '../../src/renderer/materialRegistry.js';
import { computeShieldFraction } from '../../src/components/ship/shieldUtils.js';
import { SHIELD_TUNING, SHIELD_VISUALS } from '../../src/config/renderer.js';

describe('ShieldBubble visibility behavior (static analysis)', () => {
  const shipFilePath = path.resolve(__dirname, '../../src/components/ship/ShipShield.tsx');
  const configFilePath = path.resolve(__dirname, '../../src/config/effects.ts');

  it('fixes HULL_TINT threshold to prevent always-on hull tinting', () => {
    const txt = fs.readFileSync(configFilePath, 'utf-8');

    // HULL_TINT should have a low threshold, not 1.00 which would always apply
    expect(txt).toContain('tintThreshold: 0.02');
    expect(txt).not.toContain('tintThreshold: 1.00');
    expect(txt).not.toContain('tintThreshold: 1.0,');
  });

  it.each([0, 0.5, 1, 50, 100])('calculates visibility for %s shield HP', (shield) => {
    expect(computeShieldFraction(shield, 100, 1, 'fighter').shouldDisplay).toBe(shield >= 1);
  });

  it('applies SHIELD_RENDER_ORDER constant with positive value', () => {
    expect(SHIELD_RENDER_ORDER).toBeGreaterThan(0);
    const txt = fs.readFileSync(shipFilePath, 'utf-8');
    expect(txt.includes('renderOrder={SHIELD_RENDER_ORDER}')).toBe(true);
  });

  it('enables depth testing on the shield hex material factory', () => {
    const mat = createShieldHexShaderMaterial('carrier', 'blue');
    expect(mat.depthTest).toBe(true);
    expect(mat.depthWrite).toBe(false);
    mat.dispose();
  });

  it('ensures shield shader uniforms reflect the config and that a minimum alpha floor is applied', () => {
    (['fighter', 'corvette', 'frigate', 'destroyer', 'carrier'] as const).forEach((hull) => {
      const cfg = SHIELD_VISUALS[hull];
      const mat = createShieldHexShaderMaterial(hull, 'blue');
      const uniforms = (mat as any).uniforms;

      // Shader should pick up per-hull maxAlpha from SHIELD_VISUALS
      expect(uniforms.uMaxAlpha.value).toBeCloseTo(cfg.maxAlpha ?? 0);

      // Shader should pick up global tuning values
      expect(uniforms.uMinAlphaFloor.value).toBeCloseTo(SHIELD_TUNING.minAlphaFloor);
      expect(uniforms.uEdgeAlphaMul.value).toBeCloseTo(SHIELD_TUNING.edgeAlphaMul);
      expect(uniforms.uFillAlphaMul.value).toBeCloseTo(SHIELD_TUNING.fillAlphaMul);

      // When opacity is low/zero, the shader guarantees a minimum visible floor:
      // uOpacity * uMaxAlpha * uMinAlphaFloor should be the minimum alpha contributed
      const floorAlpha =
        uniforms.uOpacity.value * uniforms.uMaxAlpha.value * uniforms.uMinAlphaFloor.value;
      expect(floorAlpha).toBeGreaterThan(0);

      mat.dispose();
    });
  });
});
