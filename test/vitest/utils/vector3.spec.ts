import { expect, test } from 'vitest';
import * as v from '../../../src/utils/vector3';

test('forward/right/up vector orthonormal basis', () => {
  const pitch = 0.3;
  const yaw = 1.1;
  const roll = 0.2;
  const f = v.getForwardVector(pitch, yaw);
  const r = v.getRightVector(pitch, yaw, roll);
  const u = v.getUpVector(pitch, yaw, roll);

  // forward should be normalized in magnitude <= 1
  expect(Math.abs(v.magnitude(f) - 1)).toBeLessThan(1e-6);
  // right and up should be approximately orthogonal to forward and right respectively
  expect(Math.abs(v.dot(f, r))).toBeLessThan(1e-6);
  expect(Math.abs(v.dot(f, u))).toBeLessThan(1e-6);
  expect(Math.abs(v.dot(r, u))).toBeLessThan(1e-6);
});

test('lookAt basic', () => {
  const from = { x: 0, y: 0, z: 0 };
  const target = { x: 1, y: 0, z: 0 };
  const o = v.lookAt(from, target);
  expect(o.yaw).toBeCloseTo(0);
  expect(o.pitch).toBeCloseTo(0);

  const upTarget = { x: 0, y: 1, z: 1 };
  const o2 = v.lookAt(from, upTarget);
  expect(o2.yaw).toBeCloseTo(Math.PI / 2);
  expect(o2.pitch).toBeGreaterThan(0);
});

test('angle helpers', () => {
  expect(v.normalizeAngle(Math.PI * 3)).toBeCloseTo(Math.PI);
  expect(v.normalizeAngle(-Math.PI * 3)).toBeCloseTo(-Math.PI);
  expect(v.angleDifference(0, Math.PI)).toBeCloseTo(Math.PI);
  expect(v.lerpAngle(0, Math.PI, 0.5)).toBeCloseTo(Math.PI / 2);
  expect(v.clampTurn(2.0, 1.0)).toBeCloseTo(1.0);
  expect(v.clampTurn(-2.0, 1.0)).toBeCloseTo(-1.0);
});

test('vector ops', () => {
  const a = { x: 1, y: 2, z: 3 };
  const b = { x: -1, y: 0, z: 2 };
  expect(v.add(a, b)).toEqual({ x: 0, y: 2, z: 5 });
  expect(v.subtract(a, b)).toEqual({ x: 2, y: 2, z: 1 });
  expect(v.scale(a, 2)).toEqual({ x: 2, y: 4, z: 6 });
  expect(v.dot(a, b)).toEqual(1 * -1 + 2 * 0 + 3 * 2);
  const c = v.cross(a, b);
  expect(c).toEqual({ x: (2 * 2 - 3 * 0), y: (3 * -1 - 1 * 2), z: (1 * 0 - 2 * -1) });

  const zero = { x: 0, y: 0, z: 0 };
  expect(v.normalize(zero)).toEqual(zero);
  const d = { x: 3, y: 4, z: 0 };
  expect(v.magnitude(d)).toBeCloseTo(5);
  expect(v.magnitudeSq(d)).toBeCloseTo(25);
  const n = v.normalize(d);
  expect(n.x).toBeCloseTo(3 / 5);
  expect(n.y).toBeCloseTo(4 / 5);
  expect(n.z).toBeCloseTo(0);
});
