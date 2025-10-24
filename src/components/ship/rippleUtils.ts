import type { Vector3 } from 'three';
import type { ShieldRipple } from '../../types/index.js';
import type { ShieldRippleTuning } from '../../config/renderer.js';

export interface ScaledRipple {
  dir: Vector3;
  t0: number;
  amp: number;
  scaledAmp: number;
}

export interface ProcessedRipple {
  dir: Vector3;
  t0: number;
  amp: number;
}

export function scaleRippleAmplitudes(
  ripples: readonly ShieldRipple[],
  ampScale: number,
): ScaledRipple[] {
  return ripples.map((r) => ({
    dir: r.dir,
    t0: r.t0,
    amp: r.amp,
    scaledAmp: Math.min(1.6, 0.25 + r.amp * ampScale),
  }));
}

export function filterSignificantRipples(
  ripples: readonly ScaledRipple[],
  minAmp: number,
): ScaledRipple[] {
  return ripples.filter((r) => r.scaledAmp >= minAmp);
}

export function coalesceRipples(
  ripples: readonly ScaledRipple[],
  windowSec: number,
): ScaledRipple[] {
  const coalesced: ScaledRipple[] = [];

  for (const r of ripples) {
    if (coalesced.length === 0) {
      coalesced.push({ ...r });
      continue;
    }

    const last = coalesced[coalesced.length - 1];
    const timeDiff = r.t0 - last.t0;

    if (timeDiff <= windowSec) {
      last.scaledAmp = Math.min(1.6, last.scaledAmp + r.scaledAmp * 0.6);
      last.t0 = Math.min(last.t0, r.t0);
    } else {
      coalesced.push({ ...r });
    }
  }

  return coalesced;
}

export function sliceToMaxRipples(
  ripples: readonly ScaledRipple[],
  maxRipples: number,
): ScaledRipple[] {
  if (ripples.length <= maxRipples) {
    return [...ripples];
  }
  return ripples.slice(Math.max(0, ripples.length - maxRipples));
}

export function processRipplesForRendering(
  ripples: readonly ShieldRipple[],
  tuning: ShieldRippleTuning,
): ProcessedRipple[] {
  const ampScale = tuning.ampScale ?? 1.9;
  const minAmp = tuning.minRenderAmp ?? 0.02;
  const windowSec = tuning.coalesceWindow ?? 0.06;
  const maxRipples = tuning.maxRipples ?? 3;

  const scaled = scaleRippleAmplitudes(ripples, ampScale);
  const significant = filterSignificantRipples(scaled, minAmp);
  const coalesced = coalesceRipples(significant, windowSec);
  const sliced = sliceToMaxRipples(coalesced, maxRipples);

  return sliced.map((r) => ({
    dir: r.dir,
    t0: r.t0,
    amp: r.scaledAmp,
  }));
}
