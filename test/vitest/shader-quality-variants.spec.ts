import { afterEach, describe, expect, it } from 'vite-plus/test';
import React from 'react';
import { cleanup, render } from '@testing-library/react';
import type { ShaderMaterial } from 'three';
import mainSequenceStarGlsl from '../../src/renderer/shaders/mainsequencestar.glsl';
import starDiskFragmentGlsl from '../../src/renderer/shaders/starDisk.fragment.glsl';
import { createMainSequenceStarMaterial } from '../../src/renderer/starDiskMaterial.js';
import { createStarSphereDepthMaterial } from '../../src/renderer/starDiskDepthMaterial.js';
import { buildShieldHexFragmentShader } from '../../src/renderer/shields/shieldHexShaders.js';
import { createShieldHexShaderMaterial } from '../../src/renderer/shields/shieldHexMaterialFactory.js';
import { QualityController } from '../../src/components/QualityController.js';
import { RENDERER_VISUAL_CONFIG } from '../../src/config/renderer.js';
import { useUiStore } from '../../src/app/uiStore.js';

const ORIGINAL_TIER = RENDERER_VISUAL_CONFIG.performanceTier;
const ORIGINAL_PRESET = useUiStore.getState().qualityPreset;

afterEach(() => {
  cleanup();
  RENDERER_VISUAL_CONFIG.performanceTier = ORIGINAL_TIER;
  useUiStore.setState({ qualityPreset: ORIGINAL_PRESET });
});

describe('LOW_QUALITY shader variants', () => {
  it('guards the star octave count with STAR_OCTAVES (2 vs 7)', () => {
    expect(mainSequenceStarGlsl).toContain('#ifdef LOW_QUALITY');
    expect(mainSequenceStarGlsl).toContain('const int STAR_OCTAVES = 2;');
    expect(mainSequenceStarGlsl).toContain('const int STAR_OCTAVES = 7;');
    expect(mainSequenceStarGlsl).toContain('for( int i=1; i<=STAR_OCTAVES; i++ )');
    // The old hard-coded bound must be gone.
    expect(mainSequenceStarGlsl).not.toContain('i<=7;');
  });

  it('guards the legacy star-disk fragment loop too', () => {
    expect(starDiskFragmentGlsl).toContain('const int STAR_OCTAVES = 2;');
    expect(starDiskFragmentGlsl).toContain('const int STAR_OCTAVES = 6;');
    expect(starDiskFragmentGlsl).not.toContain('i <= 6;');
  });

  it('collapses shield chromatic ripple evals to one under LOW_QUALITY', () => {
    const fragment = buildShieldHexFragmentShader();
    expect(fragment).toContain('#ifndef LOW_QUALITY');
    expect(fragment).toContain('float rippleG = getRippleIntensity(N, 0.0);');
    expect(fragment).toContain('float rippleR = rippleG;');
    expect(fragment).toContain('float rippleB = rippleG;');
    // High-quality path still evaluates all three chromatic offsets.
    expect(fragment).toContain('getRippleIntensity(N, 0.01)');
    expect(fragment).toContain('getRippleIntensity(N, -0.01)');
  });

  it('injects LOW_QUALITY into the star material only for the low tier', () => {
    RENDERER_VISUAL_CONFIG.performanceTier = 'high';
    const high = createMainSequenceStarMaterial({ organic: null, noise: null });
    expect(high.defines?.LOW_QUALITY).toBeUndefined();

    RENDERER_VISUAL_CONFIG.performanceTier = 'low';
    const low = createMainSequenceStarMaterial({ organic: null, noise: null });
    expect(low.defines?.LOW_QUALITY).toBe('1');
  });

  it('injects LOW_QUALITY into the shield material only for the low tier', () => {
    RENDERER_VISUAL_CONFIG.performanceTier = 'high';
    const high = createShieldHexShaderMaterial('fighter', 'blue');
    expect(high.defines?.LOW_QUALITY).toBeUndefined();

    RENDERER_VISUAL_CONFIG.performanceTier = 'low';
    const low = createShieldHexShaderMaterial('fighter', 'blue');
    expect(low.defines?.LOW_QUALITY).toBe('1');
  });

  it('mirrors the visual material define into the depth material', () => {
    RENDERER_VISUAL_CONFIG.performanceTier = 'low';
    const visual = createMainSequenceStarMaterial({ organic: null, noise: null });
    const depth = createStarSphereDepthMaterial(visual) as ShaderMaterial;

    expect(depth.defines?.DEPTH_PASS).toBe('1');
    expect(depth.defines?.LOW_QUALITY).toBe('1');
  });

  it('mirrors the resolved tier synchronously before tier-dependent siblings render', () => {
    const observed: string[] = [];
    function Probe(): null {
      observed.push(RENDERER_VISUAL_CONFIG.performanceTier);
      return null;
    }

    useUiStore.setState({ qualityPreset: 'low', detectedQualityTier: 'high' });
    render(
      React.createElement(
        React.Fragment,
        null,
        React.createElement(QualityController),
        React.createElement(Probe),
      ),
    );

    expect(observed[0]).toBe('low');
    expect(RENDERER_VISUAL_CONFIG.performanceTier).toBe('low');
  });
});
