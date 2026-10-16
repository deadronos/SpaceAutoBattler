import { useEffect, useMemo, useRef } from 'react';
import type React from 'react';
import { PerformanceMonitor } from '@react-three/drei';
import { useUiStore } from '../app/uiStore.js';
import { RENDERER_VISUAL_CONFIG } from '../config/renderer.js';
import { detectInitialQualityTier, resolveQualitySettings } from '../config/quality.js';

/**
 * Probes for a WebGL context and, when present, reads the coarse capability we
 * forward to `detectInitialQualityTier`. Inert under vitest/happy-dom and any
 * headless environment so the auto-tier monitor never mounts there.
 */
function detectWebGLInfo(): { available: boolean; maxTextureSize?: number } {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return { available: false };
  }
  try {
    const canvas = document.createElement('canvas');
    const gl = (canvas.getContext('webgl2') ??
      canvas.getContext('webgl') ??
      canvas.getContext('experimental-webgl')) as
      | WebGLRenderingContext
      | WebGL2RenderingContext
      | null;
    if (!gl) {
      return { available: false };
    }
    const maxTextureSize = gl.getParameter(gl.MAX_TEXTURE_SIZE) as number;
    // Release the probe context now: browsers cap live WebGL contexts (~16 in Chrome) and
    // evict the oldest when the cap is hit, which can be the game renderer's own context.
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return {
      available: true,
      maxTextureSize: Number.isFinite(maxTextureSize) ? maxTextureSize : undefined,
    };
  } catch {
    return { available: false };
  }
}

/**
 * Render-only bridge between the UI quality preset and the renderer.
 *
 * - Mirrors the resolved tier into `RENDERER_VISUAL_CONFIG.performanceTier` so
 *   `detailPolicy` LOD follows the preset. This writes to a module-level config
 *   singleton and deliberately does **not** restore the previous value on
 *   unmount: the next mount (or the shipped `'high'` default) re-establishes it.
 * - When the preset is `'auto'` on a real GPU context, mounts drei's
 *   `PerformanceMonitor` and maps FPS bands onto `detectedQualityTier`. It is
 *   inert (returns `null`) headless, under happy-dom, or without WebGL.
 *
 * Must be mounted inside `<Canvas>`.
 */
export function QualityController(): React.ReactElement | null {
  const qualityPreset = useUiStore((s) => s.qualityPreset);
  const detectedQualityTier = useUiStore((s) => s.detectedQualityTier);
  const setDetectedQualityTier = useUiStore((s) => s.setDetectedQualityTier);

  const quality = resolveQualitySettings(qualityPreset, detectedQualityTier);

  // Mirror the resolved tier into the module singleton synchronously during
  // render, before any tier-dependent children render. Material factories read
  // this config (never React) at creation time, and `BattleSceneContent` renders
  // after this component, so a preset change must land here first or the
  // remounted/rebuild materials would compile with the previous tier's defines.
  RENDERER_VISUAL_CONFIG.performanceTier = quality.tier;

  useEffect(() => {
    RENDERER_VISUAL_CONFIG.performanceTier = quality.tier;
  }, [quality.tier]);

  const webgl = useMemo(() => detectWebGLInfo(), []);
  const gpuAvailable = webgl.available;
  const seededRef = useRef(false);

  useEffect(() => {
    if (qualityPreset !== 'auto' || !gpuAvailable || seededRef.current) return;
    seededRef.current = true;
    const nav = typeof navigator !== 'undefined' ? navigator : undefined;
    setDetectedQualityTier(
      detectInitialQualityTier({
        maxTextureSize: webgl.maxTextureSize,
        hardwareConcurrency: nav?.hardwareConcurrency,
        deviceMemory: (nav as (Navigator & { deviceMemory?: number }) | undefined)?.deviceMemory,
      }),
    );
  }, [qualityPreset, gpuAvailable, setDetectedQualityTier, webgl.maxTextureSize]);

  if (qualityPreset !== 'auto' || !gpuAvailable) {
    return null;
  }

  return (
    <PerformanceMonitor
      flipflops={3}
      onIncline={() => setDetectedQualityTier('high')}
      onDecline={() => setDetectedQualityTier('low')}
      onFallback={() => setDetectedQualityTier('medium')}
    />
  );
}

export default QualityController;
