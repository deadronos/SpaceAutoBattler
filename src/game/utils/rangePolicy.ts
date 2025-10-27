import { AI_CONFIG } from '../config.js';
import { SeededRng } from '../../utils/rng.js';

export type RangePolicyConfig = typeof AI_CONFIG;

export function isLegacyRangePolicy(config: RangePolicyConfig = AI_CONFIG): boolean {
  return config.rangePolicy === 'v0.1.1-exp';
}

export function applyRangeVariance(
  baseRange: number,
  traitSeed: number,
  weaponIndex = 0,
  config: RangePolicyConfig = AI_CONFIG,
): number {
  if (!isLegacyRangePolicy(config)) {
    return baseRange;
  }

  const rangeSeed = Math.abs((traitSeed ^ (weaponIndex * 7919)) >>> 0) || 1;
  const rng = new SeededRng(rangeSeed);
  const variance = 0.05;
  const modifier = 1 + (rng.next() * 2 - 1) * variance;
  return Math.round(baseRange * modifier);
}

export function adjustProjectileSpeedForHullAndBullet(
  hull: string,
  baseSpeed: number,
  bulletType: string,
  overrideProvided = false,
  config: RangePolicyConfig = AI_CONFIG,
): number {
  if (!isLegacyRangePolicy(config) || overrideProvided) {
    return baseSpeed;
  }

  let adjusted = baseSpeed;
  if (hull === 'destroyer' || hull === 'carrier') {
    adjusted *= 1.05;
  } else if (hull === 'fighter') {
    adjusted *= 1.02;
  } else if (hull === 'corvette') {
    adjusted *= 0.98;
  } else if (hull === 'frigate') {
    adjusted *= 0.96;
  }

  if (bulletType.includes('laser')) {
    adjusted *= 0.97;
  } else if (bulletType.includes('heavy') || bulletType.includes('ion')) {
    adjusted *= 1.03;
  }

  return adjusted;
}

export function adjustBehaviorProfileRange(
  baseRange: readonly [number, number],
  style: string,
  hull: string,
  config: RangePolicyConfig = AI_CONFIG,
): readonly [number, number] {
  if (!isLegacyRangePolicy(config)) {
    return baseRange;
  }

  let [min, max] = baseRange;
  switch (style) {
    case 'artillery':
      min += 30;
      max += 50;
      break;
    case 'brawler':
      min = Math.max(20, min - 20);
      max = Math.max(min + 40, max - 10);
      break;
    case 'escort':
      min = Math.max(15, min - 10);
      max = Math.max(min + 40, max);
      break;
    case 'kiter':
      min += 10;
      max += 30;
      break;
    default:
      break;
  }

  if (hull === 'carrier' || hull === 'destroyer') {
    min += 10;
    max += 30;
  }

  if (max - min < 40) {
    max = min + 40;
  }
  if (min < 10) {
    min = 10;
  }
  if (max <= min) {
    max = min + 40;
  }

  if (min === baseRange[0] && max === baseRange[1]) {
    return baseRange;
  }

  return [min, max] as const;
}
