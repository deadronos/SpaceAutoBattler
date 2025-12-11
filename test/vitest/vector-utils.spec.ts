import { describe, it, expect } from 'vitest';
import { Quaternion, Vector3, MathUtils } from 'three';
import {
  getForwardFromQuaternion,
  getUpFromQuaternion,
  getRightFromQuaternion,
} from '../../src/utils/vector.js';

describe('Vector utilities', () => {
  describe('getForwardFromQuaternion', () => {
    it('should return forward direction (0, 0, 1) for identity quaternion', () => {
      const q = new Quaternion();
      const result = getForwardFromQuaternion(q);

      expect(result.x).toBeCloseTo(0);
      expect(result.y).toBeCloseTo(0);
      expect(result.z).toBeCloseTo(1);
    });

    it('should rotate forward vector correctly for 90deg Y rotation', () => {
      const q = new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), MathUtils.degToRad(90));
      const result = getForwardFromQuaternion(q);

      // 90deg Y rotation should rotate Z+ to X+
      expect(result.x).toBeCloseTo(1, 5);
      expect(result.y).toBeCloseTo(0, 5);
      expect(result.z).toBeCloseTo(0, 5);
    });

    it('should reuse the provided output vector', () => {
      const q = new Quaternion();
      const out = new Vector3();
      const result = getForwardFromQuaternion(q, out);

      expect(result).toBe(out);
    });
  });

  describe('getUpFromQuaternion', () => {
    it('should return up direction (0, 1, 0) for identity quaternion', () => {
      const q = new Quaternion();
      const result = getUpFromQuaternion(q);

      expect(result.x).toBeCloseTo(0);
      expect(result.y).toBeCloseTo(1);
      expect(result.z).toBeCloseTo(0);
    });

    it('should rotate up vector correctly for 90deg Z rotation', () => {
      const q = new Quaternion().setFromAxisAngle(new Vector3(0, 0, 1), MathUtils.degToRad(90));
      const result = getUpFromQuaternion(q);

      // 90deg Z rotation should rotate Y+ to X-
      expect(result.x).toBeCloseTo(-1, 5);
      expect(result.y).toBeCloseTo(0, 5);
      expect(result.z).toBeCloseTo(0, 5);
    });
  });

  describe('getRightFromQuaternion', () => {
    it('should return right direction (1, 0, 0) for identity quaternion', () => {
      const q = new Quaternion();
      const result = getRightFromQuaternion(q);

      expect(result.x).toBeCloseTo(1);
      expect(result.y).toBeCloseTo(0);
      expect(result.z).toBeCloseTo(0);
    });

    it('should rotate right vector correctly for 90deg Y rotation', () => {
      const q = new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), MathUtils.degToRad(90));
      const result = getRightFromQuaternion(q);

      // 90deg Y rotation should rotate X+ to Z-
      expect(result.x).toBeCloseTo(0, 5);
      expect(result.y).toBeCloseTo(0, 5);
      expect(result.z).toBeCloseTo(-1, 5);
    });
  });
});
