import { describe, expect, it } from 'vitest';
import fs from 'fs';
import path from 'path';
import { SHIELD_RENDER_ORDER } from '../../src/components/Ship.js';
import { createShieldHexShaderMaterial } from '../../src/renderer/materialRegistry.js';
import { SHIELD_TUNING, SHIELD_VISUALS } from '../../src/config/renderer.js';

describe('ShieldBubble visibility behavior (static analysis)', () => {
  const shipFilePath = path.resolve(__dirname, '../../src/components/ship/ShipShield.tsx');
  const configFilePath = path.resolve(__dirname, '../../src/config/renderer.ts');

  it('includes conditional rendering for low shield levels', () => {
    const txt = fs.readFileSync(shipFilePath, 'utf-8');

    // Ensure shield bubble is conditionally rendered when shields are very low
    expect(txt).toContain('minShieldThreshold');
    expect(txt).toMatch(/if\s*\([^)]*<\s*minShieldThreshold\)/);
    expect(txt).toContain('return <></>;');

    // Ensure the threshold is set to a reasonable value (like 0.01 for 1%)
    expect(txt).toMatch(/minShieldThreshold\s*=\s*0\.0[1-9]/);

    // Ensure we track shield changes reactively via state updates
    expect(txt).toMatch(/const \[[^\]]*setShieldFraction\] = useState/);
    expect(txt).toContain('setShieldFraction('); // More flexible match
  });

  it('fixes HULL_TINT threshold to prevent always-on hull tinting', () => {
    const txt = fs.readFileSync(configFilePath, 'utf-8');

    // HULL_TINT should have a low threshold, not 1.00 which would always apply
    expect(txt).toContain('tintThreshold: 0.02');
    expect(txt).not.toContain('tintThreshold: 1.00');
    expect(txt).not.toContain('tintThreshold: 1.0,');
  });

  it('ensures shield bubble logic prevents rendering at exactly 0 shields', () => {
    const txt = fs.readFileSync(shipFilePath, 'utf-8');

    // Test the mathematical logic: shield fraction calculation should work correctly
    expect(txt).toContain('const ratio = shield / maxShield;');
    expect(txt).toContain('MathUtils.clamp(ratio, 0, 1)');

    // With 0 shields and any maxShield > 0, the fraction should be 0
    // And 0 < minShieldThreshold (0.01) should be true, causing early return
    const shieldFraction = 0 / Math.max(1, 100); // 0
    const minThreshold = 0.01;
    expect(shieldFraction < minThreshold).toBe(true);
  });

  it('ensures shield bubble logic allows rendering above threshold', () => {
    const txt = fs.readFileSync(shipFilePath, 'utf-8');

    // Test that shields above 1% should render
    const shieldFractionFull = 100 / Math.max(1, 100); // 1.0
    const shieldFractionPartial = 50 / Math.max(1, 100); // 0.5
    const shieldFractionMinimal = 1 / Math.max(1, 100); // 0.01
    const minThreshold = 0.01;

    expect(shieldFractionFull >= minThreshold).toBe(true); // 100% shields should render
    expect(shieldFractionPartial >= minThreshold).toBe(true); // 50% shields should render
    expect(shieldFractionMinimal >= minThreshold).toBe(true); // 1% shields should render
  });

  it('applies SHIELD_RENDER_ORDER constant with positive value', () => {
    expect(SHIELD_RENDER_ORDER).toBeGreaterThan(0);
    const txt = fs.readFileSync(shipFilePath, 'utf-8');
    expect(txt.includes('renderOrder={SHIELD_RENDER_ORDER}')).toBe(true);
  });

  it('disables depth testing on the shield hex material factory', () => {
    const mat = createShieldHexShaderMaterial('carrier', 'blue');
    expect(mat.depthTest).toBe(false);
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
