import { describe, expect, it } from 'vitest';
import { Vector3 } from 'three';
import {
  FORWARD,
  clampAngle,
  computeLeadDirection,
  orientQuaternionFromDirection,
  safeNormalize,
  steerDirection,
} from '../../src/utils/steering.js';

describe('steering utilities', () => {
  it('safely normalises vectors with fallback', () => {
    const result = safeNormalize(new Vector3(), new Vector3(2, 0, 0));
    expect(result.length()).toBeCloseTo(1, 6);
    expect(result.x).toBeCloseTo(1, 6);

    const fallbackResult = safeNormalize(new Vector3(), new Vector3(0, 0, 0), new Vector3(0, 5, 0));
    expect(fallbackResult).toEqual(new Vector3(0, 1, 0));

    const defaultFallback = safeNormalize(new Vector3(), new Vector3(0, 0, 0));
    expect(defaultFallback).toEqual(new Vector3(0, 0, 1));
  });

  it('orients quaternion from direction safely', () => {
    const direction = new Vector3(0, 1, 0);
    const quaternion = orientQuaternionFromDirection(direction);
    const rotated = new Vector3().copy(FORWARD).applyQuaternion(quaternion);
    expect(rotated.distanceTo(direction.normalize())).toBeLessThan(1e-6);

    const fallbackQuaternion = orientQuaternionFromDirection(
      new Vector3(0, 0, 0),
      new Vector3(0, 1, 0),
    );
    const fallbackRotated = new Vector3().copy(FORWARD).applyQuaternion(fallbackQuaternion);
    expect(fallbackRotated.distanceTo(new Vector3(0, 1, 0))).toBeLessThan(1e-6);
  });

  it('computes lead direction with optional velocity component', () => {
    const targetPos = new Vector3(10, 0, 0);
    const sourcePos = new Vector3(0, 0, 0);
    const velocity = new Vector3(0, 2, 0);
    const leadDir = computeLeadDirection(targetPos, sourcePos, velocity, 0.5);
    expect(leadDir.length()).toBeCloseTo(1, 6);
    expect(leadDir.x).toBeGreaterThan(0.7);
    expect(leadDir.y).toBeGreaterThan(0.2);

    const noLead = computeLeadDirection(targetPos, sourcePos, velocity, 0);
    expect(noLead.y).toBeCloseTo(0, 6);
  });

  it('steers direction respecting turn limits', () => {
    const current = new Vector3(1, 0, 0);
    const desired = new Vector3(0, 1, 0);
    const { newDir, angle } = steerDirection(current, desired, Math.PI, 0.1, new Vector3());
    expect(angle).toBeCloseTo(Math.PI / 2, 5);
    expect(newDir.length()).toBeCloseTo(1, 6);
    expect(newDir.x).toBeGreaterThan(0);
    expect(newDir.y).toBeGreaterThan(0);

    const { newDir: limited } = steerDirection(current, desired, 0, 0.1, new Vector3());
    expect(limited.x).toBeCloseTo(1, 6);
    expect(limited.y).toBeCloseTo(0, 6);
  });

  it('clamps angles within bounds with wrapping', () => {
    expect(clampAngle(4 * Math.PI, -Math.PI / 2, Math.PI / 2)).toBeCloseTo(0, 6);
    expect(clampAngle((-3 * Math.PI) / 2, -Math.PI / 2, Math.PI / 2)).toBeCloseTo(Math.PI / 2, 6);
    expect(clampAngle(Math.PI / 4, -Math.PI / 2, Math.PI / 2)).toBeCloseTo(Math.PI / 4, 6);
  });
});
