import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { getCachedCameraBasis, setCachedCameraBasis, CameraBasis } from '../../src/renderer/cameraManager.js';

describe('cameraManager cached basis', () => {
  it('returns null when userData has no cached basis', () => {
    const cam = new THREE.PerspectiveCamera();
    // Ensure userData is empty
  // @ts-expect-error - intentionally testing behavior when userData absent/empty
  cam.userData = undefined as unknown as Record<string, unknown> | undefined;
    const got = getCachedCameraBasis(cam);
    expect(got).toBeNull();
  });

  it('setter stores a basis that getter returns with correct shape', () => {
    const cam = new THREE.PerspectiveCamera();
  const right = new THREE.Vector3(1, 0, 0);
  const up = new THREE.Vector3(0, 1, 0);
  const forward = new THREE.Vector3(0, 0, 1);

  const basis: CameraBasis = { right, up, forward };
  setCachedCameraBasis(cam, basis);

    const got = getCachedCameraBasis(cam);
    expect(got).not.toBeNull();
    expect(got).toHaveProperty('right');
    expect(got).toHaveProperty('up');
    expect(got).toHaveProperty('forward');

    // Check vector values (x/y/z)
    expect(got!.right.x).toBeCloseTo(1);
    expect(got!.right.y).toBeCloseTo(0);
    expect(got!.right.z).toBeCloseTo(0);

    expect(got!.up.x).toBeCloseTo(0);
    expect(got!.up.y).toBeCloseTo(1);
    expect(got!.up.z).toBeCloseTo(0);

    expect(got!.forward!.x).toBeCloseTo(0);
    expect(got!.forward!.y).toBeCloseTo(0);
    expect(got!.forward!.z).toBeCloseTo(1);
  });

  it("setter doesn't throw when camera.userData is frozen", () => {
    const cam = new THREE.PerspectiveCamera();
    // Create a frozen userData object to simulate restrictive environments
  // Assign a frozen object to userData to simulate restrictive environments
  (cam as unknown as { userData?: Record<string, unknown> }).userData = Object.freeze({});

    const basis: CameraBasis = {
      right: new THREE.Vector3(1, 0, 0),
      up: new THREE.Vector3(0, 1, 0)
    };

    expect(() => setCachedCameraBasis(cam, basis)).not.toThrow();
    // After the call, getter may still return null (best-effort setter), but it must not throw
    const got = getCachedCameraBasis(cam);
    // Accept either null or basis depending on environment constraints
    expect(got === null || (!!got && !!got.right && !!got.up)).toBe(true);
  });
});
