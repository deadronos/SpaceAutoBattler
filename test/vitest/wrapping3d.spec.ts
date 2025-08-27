import { describe, it, expect } from 'vitest';
import { normalizePosition, wrappedDistance, type Bounds3 } from '../../src/utils/wrapping';

describe('wrapping utils 3D', () => {
  const bounds: Bounds3 = {
    min: { x: 0, y: 0, z: 0 },
    max: { x: 100, y: 100, z: 100 },
    wrap: { x: true, y: true, z: true },
  };

  it('normalizes positions into range on all axes', () => {
    const p = normalizePosition({ x: 150, y: -10, z: 101 }, bounds);
    expect(p.x).toBeGreaterThanOrEqual(0);
    expect(p.x).toBeLessThan(100);
    expect(p.y).toBeGreaterThanOrEqual(0);
    expect(p.y).toBeLessThan(100);
    expect(p.z).toBeGreaterThanOrEqual(0);
    expect(p.z).toBeLessThan(100);
  });

  it('wrappedDistance accounts for shortest path across edges', () => {
    // Points are 2 units apart across wrap on x-axis (98 -> 2)
    const a = { x: 98, y: 50, z: 50 };
    const b = { x: 2, y: 50, z: 50 };
    expect(wrappedDistance(a, b, bounds)).toBeCloseTo(4); // 98->100 is 2, 0->2 is 2; shortest delta is -4 or 4 total distance 4
  });
});
