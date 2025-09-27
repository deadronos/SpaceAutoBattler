import { describe, expect, it } from 'vitest';
import { Quaternion, Vector3 } from 'three';
import {
  computeStarDiskQuaternion,
  createViewAlignmentScratch,
  computeViewAlignment,
  type ViewAlignment,
} from '../../src/renderer/starDiskOrientation.js';

describe('star disk orientation helpers', () => {
  it('aligns +Z with the provided direction when computing the base quaternion', () => {
    const quat = computeStarDiskQuaternion({ x: 0, y: 1, z: 0 });
    const transformedForward = new Vector3(0, 0, 1).applyQuaternion(quat);
    expect(transformedForward.x).toBeCloseTo(0, 6);
    expect(transformedForward.y).toBeCloseTo(1, 6);
    expect(transformedForward.z).toBeCloseTo(0, 6);
  });

  it('returns identity when the direction vector is invalid', () => {
    const quat = computeStarDiskQuaternion({ x: 0, y: 0, z: 0 });
    const identity = new Quaternion();
    expect(quat.x).toBeCloseTo(identity.x, 6);
    expect(quat.y).toBeCloseTo(identity.y, 6);
    expect(quat.z).toBeCloseTo(identity.z, 6);
    expect(quat.w).toBeCloseTo(identity.w, 6);
  });

  it('computes view alignment for head-on and edge-on camera angles', () => {
    const scratch = createViewAlignmentScratch();
    const meshQuaternion = new Quaternion();
    const meshPosition = new Vector3(0, 0, 0);
    const alignment: ViewAlignment = { x: 0, y: 0, z: 1 };

    const frontCamera = new Vector3(0, 0, 10);
    computeViewAlignment(meshQuaternion, meshPosition, frontCamera, scratch, alignment);
    expect(alignment.x).toBeCloseTo(0, 6);
    expect(alignment.y).toBeCloseTo(0, 6);
    expect(alignment.z).toBeCloseTo(1, 6);

    const sideCamera = new Vector3(10, 0, 0);
    computeViewAlignment(meshQuaternion, meshPosition, sideCamera, scratch, alignment);
    expect(alignment.x).toBeCloseTo(1, 6);
    expect(alignment.y).toBeCloseTo(0, 6);
    expect(alignment.z).toBeCloseTo(0, 6);
  });
});
