import { describe, it, expect } from 'vitest';
import { pointInPolygon, distancePointToSegment, circleIntersectsPolygon, polygonSimplify } from '../../src/math/polygon';

describe('polygon math utilities', () => {
  it('pointInPolygon works for inside/outside', () => {
    const poly: [number, number][] = [[0,0],[10,0],[10,10],[0,10]];
    expect(pointInPolygon([5,5], poly)).toBe(true);
    expect(pointInPolygon([15,5], poly)).toBe(false);
  });

  it('distancePointToSegment computes correct distance', () => {
    expect(distancePointToSegment([5,5],[0,0],[10,0])).toBeCloseTo(5);
    expect(distancePointToSegment([5,0],[0,0],[10,0])).toBeCloseTo(0);
  });

  it('circleIntersectsPolygon detects intersection', () => {
    const poly: [number, number][] = [[0,0],[10,0],[10,10],[0,10]];
    expect(circleIntersectsPolygon([5,5], 1, poly)).toBe(true);
    expect(circleIntersectsPolygon([15,5], 1, poly)).toBe(false);
    expect(circleIntersectsPolygon([10,5], 1, poly)).toBe(true);
  });

  it('polygonSimplify reduces points for tolerance', () => {
    const poly: [number, number][] = [[0,0],[5,0],[10,0],[10,10],[0,10]];
    const simplified = polygonSimplify(poly, 5);
    expect(simplified.length).toBeLessThan(poly.length);
  });
});
