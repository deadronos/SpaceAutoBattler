import { MathUtils } from 'three';
import type { ShipHull } from '../../types/index.js';

/**
 * Result of shield fraction computation.
 */
export interface ShieldFractionResult {
  fraction: number;
  shouldDisplay: boolean;
  warnings: string[];
}

/** Return shield HP as an allocation-free, bounded fraction for render updates. */
export function normalizedShieldFraction(shield: number, maxShield: number): number {
  const ratio = shield / maxShield;
  return Number.isFinite(maxShield) && maxShield > 0 && Number.isFinite(ratio)
    ? MathUtils.clamp(ratio, 0, 1)
    : 0;
}

/**
 * Computes the normalized shield fraction (0..1) safely.
 * Handles edge cases like zero max shield or invalid values.
 *
 * @param {number} shield - Current shield HP.
 * @param {number} maxShield - Max shield HP.
 * @param {number} shipId - Ship ID for logging.
 * @param {ShipHull} hull - Ship hull type for logging.
 * @param {number} [minThreshold=0.01] - Minimum fraction to be considered visible.
 * @returns {ShieldFractionResult} The result.
 */
export function computeShieldFraction(
  shield: number,
  maxShield: number,
  shipId: number,
  hull: ShipHull,
  minThreshold: number = 0.01,
): ShieldFractionResult {
  const warnings: string[] = [];

  if (!Number.isFinite(maxShield) || maxShield <= 0) {
    if (maxShield !== 0) {
      warnings.push(`Ship ${shipId} (${hull}) has invalid maxShield: ${maxShield}`);
    }
    return { fraction: 0, shouldDisplay: false, warnings };
  }

  if (!Number.isFinite(shield)) {
    warnings.push(`Ship ${shipId} (${hull}) has invalid shield: ${shield}`);
    return { fraction: 0, shouldDisplay: false, warnings };
  }

  const ratio = shield / maxShield;
  if (!Number.isFinite(ratio)) {
    warnings.push(
      `Ship ${shipId} (${hull}) computed invalid ratio (shield=${shield}, maxShield=${maxShield}, ratio=${ratio})`,
    );
    return { fraction: 0, shouldDisplay: false, warnings };
  }

  const fraction = normalizedShieldFraction(shield, maxShield);
  const shouldDisplay = fraction >= minThreshold;

  return { fraction, shouldDisplay, warnings };
}

/**
 * Determines if the shield should be displayed based on fraction.
 *
 * @param {number} fraction - The shield fraction.
 * @param {number} threshold - The visibility threshold.
 * @returns {boolean} True if visible.
 */
export function shouldDisplayShield(fraction: number, threshold: number): boolean {
  return fraction >= threshold;
}

export const SHIELD_LOD_MID_DISTANCE = 450;
export const SHIELD_LOD_FAR_DISTANCE = 1200;
export const SHIELD_LOD_HYSTERESIS = 40;
export const SHIELD_MID_SEGMENTS = 24;
export const SHIELD_FAR_SEGMENTS = 12;

/**
 * Resolves shield sphere segment count from camera distance with hysteresis
 * so shields avoid geometry swapping flicker near LOD thresholds.
 */
export function resolveShieldGeometrySegments(
  distance: number,
  maxSegments: number,
  previousSegments?: number,
): number {
  const nearSegments = Math.max(8, Math.floor(maxSegments));
  const midSegments = Math.min(nearSegments, SHIELD_MID_SEGMENTS);
  const farSegments = Math.min(midSegments, SHIELD_FAR_SEGMENTS);

  if (!Number.isFinite(distance) || distance < 0) {
    return nearSegments;
  }

  const midEnter = SHIELD_LOD_MID_DISTANCE;
  const midExit = SHIELD_LOD_MID_DISTANCE - SHIELD_LOD_HYSTERESIS;
  const farEnter = SHIELD_LOD_FAR_DISTANCE;
  const farExit = SHIELD_LOD_FAR_DISTANCE - SHIELD_LOD_HYSTERESIS;

  if (previousSegments === farSegments) {
    if (distance >= farExit) return farSegments;
    return distance >= midEnter ? midSegments : nearSegments;
  }
  if (previousSegments === midSegments) {
    if (distance >= farEnter) return farSegments;
    if (distance < midExit) return nearSegments;
    return midSegments;
  }
  if (distance >= farEnter) return farSegments;
  if (distance >= midEnter) return midSegments;
  return nearSegments;
}

/**
 * Validates that the shield visibility matches expectations (debug helper).
 *
 * @param {number} computedFraction - The computed fraction.
 * @param {number} shield - Raw shield HP.
 * @param {number} maxShield - Max shield HP.
 * @param {number} minThreshold - Visibility threshold.
 * @param {number} shipId - Ship ID.
 * @param {ShipHull} hull - Hull type.
 * @returns {string | null} An error message if invalid, or null.
 */
export function validateShieldVisibility(
  computedFraction: number,
  shield: number,
  maxShield: number,
  minThreshold: number,
  shipId: number,
  hull: ShipHull,
): string | null {
  if (computedFraction >= minThreshold) {
    return null;
  }

  if (shield > 0 && maxShield > 0) {
    const expectedFraction = shield / maxShield;
    if (expectedFraction >= minThreshold) {
      return `Shield bubble should be visible but isn't for ship ${shipId} (${hull}): shield=${shield}, maxShield=${maxShield}, expectedFraction=${expectedFraction.toFixed(3)}, computedFraction=${computedFraction.toFixed(3)}, threshold=${minThreshold}`;
    }
  }

  return null;
}
