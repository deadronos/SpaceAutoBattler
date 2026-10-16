import { afterEach, describe, expect, it, vi } from 'vite-plus/test';
import React from 'react';
import { cleanup, fireEvent, render, screen, act } from '@testing-library/react';
import {
  QUALITY_PRESETS,
  detectInitialQualityTier,
  resolveQualitySettings,
  resolveQualityTier,
  type QualitySettings,
} from '../../src/config/quality.js';
import { SettingsDrawer } from '../../src/components/HudToggleDrawer.js';
import { QualityController } from '../../src/components/QualityController.js';
import { RENDERER_VISUAL_CONFIG } from '../../src/config/renderer.js';
import { useUiStore } from '../../src/app/uiStore.js';

// Snapshot every store field this spec can mutate so we never leak state into
// neighbouring specs (mirrors the pattern in ui-settings-panels.spec.tsx).
const DEFAULT_FLAGS = (() => {
  const snapshot = useUiStore.getState();
  return {
    postprocessingEnabled: snapshot.postprocessingEnabled,
    hudHealthBarsEnabled: snapshot.hudHealthBarsEnabled,
    aiV2Enabled: snapshot.aiV2Enabled,
    aiDebugEnabled: snapshot.aiDebugEnabled,
    explosionDebugEnabled: snapshot.explosionDebugEnabled,
    perfMonitorEnabled: snapshot.perfMonitorEnabled,
    perfMonitorPosition: { ...snapshot.perfMonitorPosition },
    qualityPreset: snapshot.qualityPreset,
    detectedQualityTier: snapshot.detectedQualityTier,
  };
})();

afterEach(() => {
  cleanup();
  useUiStore.setState(DEFAULT_FLAGS);
});

function countChangedKnobs(a: QualitySettings, b: QualitySettings): number {
  // Only the non-shader knobs: `starShaderOctaves`/`shieldChromatic` are binary
  // (applied for `low` only), so `medium` intentionally matches `high` on them.
  return [
    a.dpr.min !== b.dpr.min,
    a.dpr.max !== b.dpr.max,
    a.dpr.initial !== b.dpr.initial,
    a.shadows !== b.shadows,
    a.shadowMapSize !== b.shadowMapSize,
    a.ao.enabled !== b.ao.enabled,
    a.ao.halfRes !== b.ao.halfRes,
    a.ao.quality !== b.ao.quality,
    a.bloom !== b.bloom,
    a.particles.maxParticles !== b.particles.maxParticles,
    a.particles.spawnRatePerAnchor !== b.particles.spawnRatePerAnchor,
  ].filter(Boolean).length;
}

describe('quality presets', () => {
  it('resolves auto to the detected tier and other presets directly', () => {
    expect(resolveQualityTier('auto', 'medium')).toBe('medium');
    expect(resolveQualityTier('auto', 'low')).toBe('low');
    expect(resolveQualityTier('low', 'high')).toBe('low');
    expect(resolveQualityTier('medium', 'low')).toBe('medium');
    expect(resolveQualityTier('high', 'low')).toBe('high');
    // Unknown/undefined (e.g. a partial store mock) falls back to high.
    expect(resolveQualityTier(undefined, undefined)).toBe('high');
  });

  it('resolves full settings for every preset including auto', () => {
    expect(resolveQualitySettings('high', 'low').tier).toBe('high');
    expect(resolveQualitySettings('medium', 'high').tier).toBe('medium');
    expect(resolveQualitySettings('low', 'high').tier).toBe('low');
    expect(resolveQualitySettings('auto', 'medium').tier).toBe('medium');
    expect(resolveQualitySettings('auto', 'high')).toEqual(QUALITY_PRESETS.high);
    expect(resolveQualitySettings('auto', 'low')).toEqual(QUALITY_PRESETS.low);
  });

  it('keeps high as the shipped no-op baseline', () => {
    const high = QUALITY_PRESETS.high;
    expect(high.dpr).toEqual({ min: 0.5, max: 2, initial: 0.5 });
    expect(high.shadows).toBe(true);
    expect(high.shadowMapSize).toBe(2048);
    expect(high.ao).toEqual({ enabled: true, halfRes: true, quality: 'Medium' });
    expect(high.bloom).toBe(true);
    expect(high.particles).toEqual({ maxParticles: 5000, spawnRatePerAnchor: 12 });
    expect(high.starShaderOctaves).toBe(7);
    expect(high.shieldChromatic).toBe(true);
  });

  it('keeps the binary shader knobs equal for medium and high (only low differs)', () => {
    const { high, medium, low } = QUALITY_PRESETS;
    expect(medium.starShaderOctaves).toBe(high.starShaderOctaves);
    expect(medium.shieldChromatic).toBe(high.shieldChromatic);
    expect(low.starShaderOctaves).toBe(2);
    expect(low.shieldChromatic).toBe(false);
  });

  it('changes at least three knobs between adjacent presets', () => {
    const { high, medium, low } = QUALITY_PRESETS;
    expect(countChangedKnobs(high, medium)).toBeGreaterThanOrEqual(3);
    expect(countChangedKnobs(medium, low)).toBeGreaterThanOrEqual(3);
    expect(countChangedKnobs(high, low)).toBeGreaterThanOrEqual(3);
  });

  it('defaults device detection to high with missing inputs', () => {
    expect(detectInitialQualityTier()).toBe('high');
    expect(detectInitialQualityTier({})).toBe('high');
    expect(
      detectInitialQualityTier({ maxTextureSize: 2048, hardwareConcurrency: 2, deviceMemory: 2 }),
    ).toBe('low');
    expect(
      detectInitialQualityTier({ maxTextureSize: 8192, hardwareConcurrency: 16, deviceMemory: 16 }),
    ).toBe('high');
  });

  it('defaults the store preset to high and round-trips the setters', () => {
    expect(useUiStore.getState().qualityPreset).toBe('high');
    expect(useUiStore.getState().detectedQualityTier).toBe('high');

    useUiStore.getState().setQualityPreset('low');
    expect(useUiStore.getState().qualityPreset).toBe('low');

    useUiStore.getState().setDetectedQualityTier('medium');
    expect(useUiStore.getState().detectedQualityTier).toBe('medium');
  });

  it('renders the quality control and selecting Low updates the store', () => {
    render(React.createElement(SettingsDrawer));
    const trigger = screen.getByRole('button', { name: 'Simulation settings' });
    fireEvent.click(trigger);

    const group = screen.getByRole('group', { name: 'Graphics quality' });
    expect(group).toBeDefined();

    const highButton = screen.getByRole('button', { name: 'High' });
    expect(highButton.getAttribute('aria-pressed')).toBe('true');

    fireEvent.click(screen.getByRole('button', { name: 'Low' }));
    expect(useUiStore.getState().qualityPreset).toBe('low');
  });

  it('releases the WebGL capability-probe context after reading it', () => {
    const loseContext = vi.fn();
    const fakeGl = {
      MAX_TEXTURE_SIZE: 0x0d33,
      getParameter: () => 8192,
      getExtension: (name: string) => (name === 'WEBGL_lose_context' ? { loseContext } : null),
    };
    const getContext = vi
      .spyOn(HTMLCanvasElement.prototype, 'getContext')
      .mockReturnValue(fakeGl as never);
    try {
      useUiStore.setState({ qualityPreset: 'low' });
      render(React.createElement(QualityController));
      expect(getContext).toHaveBeenCalled();
      expect(loseContext).toHaveBeenCalledTimes(getContext.mock.results.length);
    } finally {
      getContext.mockRestore();
    }
  });

  it('mirrors the resolved tier and stays inert headless under auto', async () => {
    const originalTier = RENDERER_VISUAL_CONFIG.performanceTier;
    try {
      useUiStore.setState({ qualityPreset: 'auto', detectedQualityTier: 'low' });
      const { container } = render(React.createElement(QualityController));
      // happy-dom has no WebGL context, so the auto FPS monitor is inert.
      expect(container.firstChild).toBeNull();
      expect(RENDERER_VISUAL_CONFIG.performanceTier).toBe('low');

      useUiStore.setState({ qualityPreset: 'medium' });
      await act(async () => {});
      expect(RENDERER_VISUAL_CONFIG.performanceTier).toBe('medium');
    } finally {
      RENDERER_VISUAL_CONFIG.performanceTier = originalTier;
    }
  });
});
