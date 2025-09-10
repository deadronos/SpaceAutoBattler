import { describe, it, expect } from 'vitest';
import { computeInterceptPoint, type Vector3 } from '../../src/core/math/ballisticIntercept';

describe('computeInterceptPoint', () => {
  it('returns null for zero projectile speed', () => {
    const shooter: Vector3 = { x: 0, y: 0, z: 0 };
    const target: Vector3 = { x: 100, y: 0, z: 0 };
    const vel: Vector3 = { x: 1, y: 0, z: 0 };
    const res = computeInterceptPoint(shooter, 0, target, vel);
    expect(res).toBeNull();
  });

  it('predicts a direct hit for stationary target', () => {
    const shooter: Vector3 = { x: 0, y: 0, z: 0 };
    const target: Vector3 = { x: 100, y: 0, z: 0 };
    const vel: Vector3 = { x: 0, y: 0, z: 0 };
    const res = computeInterceptPoint(shooter, 50, target, vel);
    // stationary target -> intercept point equals current position
    expect(res).not.toBeNull();
    expect(res!.x).toBeCloseTo(100, 6);
    expect(res!.y).toBeCloseTo(0, 6);
  });

  it('returns null when target is faster than projectile (no solution)', () => {
    const shooter: Vector3 = { x: 0, y: 0, z: 0 };
    const target: Vector3 = { x: 100, y: 0, z: 0 };
    const vel: Vector3 = { x: 1000, y: 0, z: 0 };
    const res = computeInterceptPoint(shooter, 50, target, vel);
    expect(res).toBeNull();
  });

  it('computes intercept for lateral moving target', () => {
    const shooter: Vector3 = { x: 0, y: 0, z: 0 };
    const target: Vector3 = { x: 100, y: 0, z: 0 };
    const vel: Vector3 = { x: 0, y: 10, z: 0 };
    // Use a tight maxLookahead to ensure the solver returns null if intercept too far
    const res = computeInterceptPoint(shooter, 50, target, vel, 10);
    expect(res).not.toBeNull();
    // intercept should be ahead of current x (positive x)
    expect(res!.x).toBeGreaterThan(100 - 1e-6);
  });

  it('respects maxLookahead and returns null if intercept is far in future', () => {
    const shooter: Vector3 = { x: 0, y: 0, z: 0 };
    const target: Vector3 = { x: 10000, y: 0, z: 0 };
    const vel: Vector3 = { x: 0, y: 0, z: 0 };
    // even though stationary, intercept time would be large; clamp should cause null
    const res = computeInterceptPoint(shooter, 10, target, vel, 1.0);
    expect(res).toBeNull();
  });
});
