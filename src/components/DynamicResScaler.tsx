import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import type React from 'react';

export type DynamicResScalerOptions = {
  minDpr?: number;
  maxDpr?: number;
  initialDpr?: number;
  targetFps?: number;
  lowerFps?: number;
  step?: number;
  smoothing?: number; // EMA alpha
  adjustIntervalMs?: number;
};

export function computeNextDpr(
  currentDpr: number,
  emaFps: number,
  options: Required<DynamicResScalerOptions>,
): number {
  const { minDpr, maxDpr, targetFps, lowerFps, step } = options;

  // Hysteresis: only upscale if comfortably above target, downscale if below lowerFps
  if (emaFps >= targetFps + 6) {
    return Math.min(maxDpr, parseFloat((currentDpr + step).toFixed(3)));
  }
  if (emaFps <= lowerFps) {
    return Math.max(minDpr, parseFloat((currentDpr - step).toFixed(3)));
  }
  return currentDpr;
}

/**
 * DynamicResScaler
 * Monitors frame timings and adjusts renderer DPR (pixel ratio) to balance
 * performance and visual quality.
 *
 * Defaults aim for a lower default DPR (0.5) so lower-end hardware starts smooth,
 * and scales up when budget is available.
 */
export default function DynamicResScaler({
  minDpr = 0.5,
  maxDpr = 2,
  initialDpr = 0.5,
  targetFps = 60,
  lowerFps = 55,
  step = 0.25,
  smoothing = 0.08,
  adjustIntervalMs = 500,
}: DynamicResScalerOptions): React.ReactElement | null {
  const { gl, size } = useThree();
  const emaFpsRef = useRef<number | null>(null);
  const lastAdjustRef = useRef<number>(0);
  const dprRef = useRef<number>(initialDpr);

  useEffect(() => {
    // Apply initial DPR
    try {
      gl.setPixelRatio(initialDpr);
      // ensure drawing buffer size is updated
      gl.setSize(size.width, size.height, false);
    } catch {
      // ignore in non-browser environments
    }
    return () => {
      // Reset to device pixel ratio on unmount
      try {
        gl.setPixelRatio(typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1);
        gl.setSize(size.width, size.height, false);
      } catch {
        // ignore
      }
    };
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useFrame((state, delta) => {
    const now = performance.now();

    const fps = delta > 0 ? 1 / delta : 60;

    // Initialize EMA
    if (emaFpsRef.current === null) {
      emaFpsRef.current = fps;
    } else {
      emaFpsRef.current = smoothing * fps + (1 - smoothing) * emaFpsRef.current;
    }

    // Only adjust at most every adjustIntervalMs
    if (now - lastAdjustRef.current < adjustIntervalMs) {
      return;
    }

    lastAdjustRef.current = now;

    const emaFps = emaFpsRef.current ?? fps;

    const options = {
      minDpr,
      maxDpr,
      initialDpr,
      targetFps,
      lowerFps,
      step,
      smoothing,
      adjustIntervalMs,
    } as Required<DynamicResScalerOptions>;

    const currentDpr = dprRef.current;
    const nextDpr = computeNextDpr(currentDpr, emaFps, options);

    if (nextDpr !== currentDpr) {
      dprRef.current = nextDpr;
      try {
        gl.setPixelRatio(nextDpr);
        // ensure drawing buffer size is updated without changing canvas style
        gl.setSize(size.width, size.height, false);
      } catch {
        // ignore errors in non-browser/test envs
      }
    }
  });

  return null;
}
