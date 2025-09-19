import { describe, expect, test } from 'vitest';
import { getForwardVector, getRightVector, getUpVector, dot } from '../../src/utils/vector3.js';

// helper dot from utils? Wait dot function defined in same file; we imported above. yes.

describe('vector3 orientation', () => {
  test('right vector accounts for pitch', () => {
    const pitch = Math.PI / 2; // looking straight up
    const yaw = 0;
    const roll = 0;
    const right = getRightVector(pitch, yaw, roll);
    expect(right.x).toBeCloseTo(1, 6);
    expect(right.y).toBeCloseTo(0, 6);
    expect(right.z).toBeCloseTo(0, 6);
  });

  test('basis vectors remain orthogonal after roll', () => {
    const pitch = 0;
    const yaw = 0;
    const roll = Math.PI / 2; // 90 degree roll
    const forward = getForwardVector(pitch, yaw);
    const right = getRightVector(pitch, yaw, roll);
    const up = getUpVector(pitch, yaw, roll);
    expect(dot(forward, right)).toBeCloseTo(0, 6);
    expect(dot(forward, up)).toBeCloseTo(0, 6);
    expect(dot(right, up)).toBeCloseTo(0, 6);
    // After a 90deg roll, right vector should align with world up
    expect(right.x).toBeCloseTo(0, 6);
    expect(right.y).toBeCloseTo(0, 6);
    expect(right.z).toBeCloseTo(1, 6);
  });
});
