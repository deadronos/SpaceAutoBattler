import { describe, expect, it } from 'vitest';
import {
  adjustBehaviorProfileRange,
  adjustProjectileSpeedForHullAndBullet,
  applyRangeVariance,
  isLegacyRangePolicy,
  type RangePolicyConfig,
} from '../../src/game/utils/rangePolicy.js';
import { SeededRng } from '../../src/utils/rng.js';

const legacyConfig: RangePolicyConfig = { rangePolicy: 'v0.1.1-exp' } as RangePolicyConfig;
const modernConfig: RangePolicyConfig = { rangePolicy: 'none' } as RangePolicyConfig;

describe('rangePolicy', () => {
  it('detects legacy range policy', () => {
    expect(isLegacyRangePolicy(legacyConfig)).toBe(true);
    expect(isLegacyRangePolicy(modernConfig)).toBe(false);
  });

  it('applies deterministic range variance for legacy policy', () => {
    const baseRange = 300;
    const traitSeed = 12345;

    const expectedPrimary = (() => {
      const seed = Math.abs((traitSeed ^ (0 * 7919)) >>> 0) || 1;
      const rng = new SeededRng(seed);
      const variance = 0.05;
      const modifier = 1 + (rng.next() * 2 - 1) * variance;
      return Math.round(baseRange * modifier);
    })();

    const expectedTurret = (() => {
      const seed = Math.abs((traitSeed ^ (2 * 7919)) >>> 0) || 1;
      const rng = new SeededRng(seed);
      const variance = 0.05;
      const modifier = 1 + (rng.next() * 2 - 1) * variance;
      return Math.round(baseRange * modifier);
    })();

    expect(applyRangeVariance(baseRange, traitSeed, 0, legacyConfig)).toBe(expectedPrimary);
    expect(applyRangeVariance(baseRange, traitSeed, 2, legacyConfig)).toBe(expectedTurret);
    expect(applyRangeVariance(baseRange, traitSeed, 0, modernConfig)).toBe(baseRange);
  });

  it('adjusts projectile speed according to hull and bullet type under legacy policy', () => {
    const baseSpeed = 100;
    const destroyerLaser = adjustProjectileSpeedForHullAndBullet(
      'destroyer',
      baseSpeed,
      'bullet:laser',
      false,
      legacyConfig,
    );
    expect(destroyerLaser).toBeCloseTo(baseSpeed * 1.05 * 0.97, 5);

    const fighterIon = adjustProjectileSpeedForHullAndBullet(
      'fighter',
      baseSpeed,
      'bullet:ion',
      false,
      legacyConfig,
    );
    expect(fighterIon).toBeCloseTo(baseSpeed * 1.02 * 1.03, 5);

    const overridden = adjustProjectileSpeedForHullAndBullet(
      'frigate',
      baseSpeed,
      'bullet:kinetic',
      true,
      legacyConfig,
    );
    expect(overridden).toBe(baseSpeed);

    const nonLegacy = adjustProjectileSpeedForHullAndBullet(
      'destroyer',
      baseSpeed,
      'bullet:laser',
      false,
      modernConfig,
    );
    expect(nonLegacy).toBe(baseSpeed);
  });

  it('adjusts behaviour profile ranges consistent with legacy policy rules', () => {
    const baseRange: readonly [number, number] = [150, 220];
    const artillery = adjustBehaviorProfileRange(baseRange, 'artillery', 'carrier', legacyConfig);
    expect(artillery).toEqual([190, 300]);

    const escort = adjustBehaviorProfileRange([60, 110], 'escort', 'frigate', legacyConfig);
    expect(escort).toEqual([50, 110]);

    const unchanged = adjustBehaviorProfileRange(baseRange, 'support', 'frigate', legacyConfig);
    expect(unchanged).toBe(baseRange);

    const nonLegacy = adjustBehaviorProfileRange(baseRange, 'artillery', 'carrier', modernConfig);
    expect(nonLegacy).toBe(baseRange);
  });
});
