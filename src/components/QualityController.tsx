import { useEffect, useMemo, useRef } from 'react';
import type React from 'react';
import { PerformanceMonitor } from '@react-three/drei';
import { useUiStore } from '../app/uiStore.js';
import { RENDERER_VISUAL_CONFIG } from '../config/renderer.js';
import { detectInitialQualityTier, resolveQualitySettings } from '../config/quality.js';

/**
 * Returns true only when a WebGL context can actually be created. Inert under
 * vitest/happy-dom and any headless environment so the auto-tier monitor never
 * mounts there.
 */
function hasWebGLContext(): boolean {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return false;
  }
  try {
    const canvas = document.createElement('canvas');
    const gl =
      canvas.getContext('webgl2') ??
      canvas.getContext('webgl') ??
      canvas.getContext('experimental-webgl');
    return gl != null;
  } catch {
    return false;
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

  useEffect(() => {
    RENDERER_VISUAL_CONFIG.performanceTier = quality.tier;
  }, [quality.tier]);

  const gpuAvailable = useMemo(() => hasWebGLContext(), []);
  const seededRef = useRef(false);

  useEffect(() => {
    if (qualityPreset !== 'auto' || !gpuAvailable || seededRef.current) return;
    seededRef.current = true;
    const nav = typeof navigator !== 'undefined' ? navigator : undefined;
    setDetectedQualityTier(
      detectInitialQualityTier({
        hardwareConcurrency: nav?.hardwareConcurrency,
        deviceMemory: (nav as (Navigator & { deviceMemory?: number }) | undefined)?.deviceMemory,
      }),
    );
  }, [qualityPreset, gpuAvailable, setDetectedQualityTier]);

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
