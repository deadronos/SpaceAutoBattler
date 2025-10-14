import { MathUtils } from 'three';
import type { ShipHull } from '../../types/index.js';

export interface ShieldFractionResult {
  fraction: number;
  shouldDisplay: boolean;
  warnings: string[];
}

export function computeShieldFraction(
  shield: number,
  maxShield: number,
  shipId: number,
  hull: ShipHull,
  minThreshold: number = 0.01
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
      `Ship ${shipId} (${hull}) computed invalid ratio (shield=${shield}, maxShield=${maxShield}, ratio=${ratio})`
    );
    return { fraction: 0, shouldDisplay: false, warnings };
  }

  const fraction = MathUtils.clamp(ratio, 0, 1);
  const shouldDisplay = fraction >= minThreshold;

  return { fraction, shouldDisplay, warnings };
}

export function shouldDisplayShield(fraction: number, threshold: number): boolean {
  return fraction >= threshold;
}

export function validateShieldVisibility(
  computedFraction: number,
  shield: number,
  maxShield: number,
  minThreshold: number,
  shipId: number,
  hull: ShipHull,
  latestFraction?: number
): string | null {
  if (computedFraction >= minThreshold) {
    return null;
  }

  const hasLatest = latestFraction != null && Number.isFinite(latestFraction);
  if (hasLatest && (latestFraction as number) >= minThreshold) {
    return null;
  }

  if (shield > 0 && maxShield > 0) {
    const expectedFraction = shield / maxShield;
    if (expectedFraction >= minThreshold) {
      const extraDetail = hasLatest
        ? `, latestFraction=${(latestFraction as number).toFixed(3)}`
        : '';
      return `Shield bubble should be visible but isn't for ship ${shipId} (${hull}): shield=${shield}, maxShield=${maxShield}, expectedFraction=${expectedFraction.toFixed(3)}, computedFraction=${computedFraction.toFixed(3)}, threshold=${minThreshold}${extraDetail}`;
    }
  }

  return null;
}
