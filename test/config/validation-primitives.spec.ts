import { describe, expect, it } from 'vite-plus/test';
import {
  describe as describeValue,
  isFiniteNumber,
  isInUnitInterval,
  isNonNegativeFinite,
  isPositiveFinite,
} from '../../src/game/config/validationPrimitives.js';

describe('validationPrimitives', () => {
  it('isFiniteNumber accepts finite numbers and rejects non-numbers or infinities', () => {
    expect(isFiniteNumber(0)).toBe(true);
    expect(isFiniteNumber(-42.5)).toBe(true);
    expect(isFiniteNumber(Number.NaN)).toBe(false);
    expect(isFiniteNumber(Number.POSITIVE_INFINITY)).toBe(false);
    expect(isFiniteNumber(Number.NEGATIVE_INFINITY)).toBe(false);
    expect(isFiniteNumber('1')).toBe(false);
    expect(isFiniteNumber(null)).toBe(false);
  });

  it('isPositiveFinite requires finite numbers strictly greater than 0', () => {
    expect(isPositiveFinite(0.001)).toBe(true);
    expect(isPositiveFinite(0)).toBe(false);
    expect(isPositiveFinite(-1)).toBe(false);
    expect(isPositiveFinite(Number.POSITIVE_INFINITY)).toBe(false);
  });

  it('isInUnitInterval checks closed [0, 1] bounds', () => {
    expect(isInUnitInterval(0)).toBe(true);
    expect(isInUnitInterval(0.5)).toBe(true);
    expect(isInUnitInterval(1)).toBe(true);
    expect(isInUnitInterval(-0.01)).toBe(false);
    expect(isInUnitInterval(1.01)).toBe(false);
    expect(isInUnitInterval(Number.NaN)).toBe(false);
  });

  it('isNonNegativeFinite accepts 0 and positive finite numbers', () => {
    expect(isNonNegativeFinite(0)).toBe(true);
    expect(isNonNegativeFinite(10)).toBe(true);
    expect(isNonNegativeFinite(-0.001)).toBe(false);
    expect(isNonNegativeFinite(Number.NaN)).toBe(false);
  });

  it('describe formats values consistently', () => {
    expect(describeValue(42)).toBe('42');
    expect(describeValue(Number.NaN)).toBe('NaN');
    expect(describeValue('abc')).toBe('"abc"');
    expect(describeValue(null)).toBe('null');
    expect(describeValue([1, 2])).toBe('array');
    expect(describeValue(undefined)).toBe('undefined');
    expect(describeValue({})).toBe('object');
  });
});
