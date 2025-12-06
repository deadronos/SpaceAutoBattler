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

/**
 * Scales ripple amplitudes for rendering impact.
 *
 * @param {readonly ShieldRipple[]} ripples - The list of ripples.
 * @param {number} ampScale - Scaling factor.
 * @returns {ScaledRipple[]} Scaled ripples.
 */
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

/**
 * Filters out ripples that are too weak to be seen.
 *
 * @param {readonly ScaledRipple[]} ripples - The list of ripples.
 * @param {number} minAmp - Minimum amplitude threshold.
 * @returns {ScaledRipple[]} Filtered list.
 */
export function filterSignificantRipples(
  ripples: readonly ScaledRipple[],
  minAmp: number,
): ScaledRipple[] {
  // Manual filtering loop for better performance than filter()
  const result: ScaledRipple[] = [];
  for (let i = 0; i < ripples.length; i++) {
    if (ripples[i].scaledAmp >= minAmp) {
      result.push(ripples[i]);
    }
  }
  return result;
}

/**
 * Coalesces ripples that are close in time to avoid shader slot exhaustion.
 *
 * @param {readonly ScaledRipple[]} ripples - The list of ripples.
 * @param {number} windowSec - Time window for coalescing.
 * @returns {ScaledRipple[]} Coalesced list.
 */
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

/**
 * Slices the ripple list to fit within the shader's maximum count.
 *
 * @param {readonly ScaledRipple[]} ripples - The list of ripples.
 * @param {number} maxRipples - Maximum allowed ripples.
 * @returns {ScaledRipple[]} Sliced list.
 */
export function sliceToMaxRipples(
  ripples: readonly ScaledRipple[],
  maxRipples: number,
): ScaledRipple[] {
  if (ripples.length <= maxRipples) {
    return [...ripples];
  }
  return ripples.slice(Math.max(0, ripples.length - maxRipples));
}

/**
 * Processes raw shield ripples into a format suitable for the shader.
 * Scales, filters, coalesces, and limits the count based on tuning config.
 *
 * @param {readonly ShieldRipple[]} ripples - The raw ripples.
 * @param {ShieldRippleTuning} tuning - Configuration for ripple processing.
 * @returns {ProcessedRipple[]} The final list of ripples for the shader.
 */
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
