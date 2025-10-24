import { Quaternion, Vector3 } from 'three';

export interface Vector3Like {
  x: number;
  y: number;
  z: number;
}

export interface ViewAlignment {
  x: number;
  y: number;
  z: number;
}

export interface ViewAlignmentScratch {
  normal: Vector3;
  tangent: Vector3;
  bitangent: Vector3;
  viewDir: Vector3;
  projected: Vector3;
}

export function computeStarDiskQuaternion(direction: Vector3Like): Quaternion {
  const vector = new Vector3(direction.x, direction.y, direction.z);
  if (
    !Number.isFinite(vector.x) ||
    !Number.isFinite(vector.y) ||
    !Number.isFinite(vector.z) ||
    vector.lengthSq() === 0
  ) {
    return new Quaternion();
  }
  vector.normalize();
  const quaternion = new Quaternion();
  quaternion.setFromUnitVectors(new Vector3(0, 0, 1), vector);
  return quaternion;
}

export function createViewAlignmentScratch(): ViewAlignmentScratch {
  return {
    normal: new Vector3(),
    tangent: new Vector3(),
    bitangent: new Vector3(),
    viewDir: new Vector3(),
    projected: new Vector3(),
  };
}

export function computeViewAlignment(
  meshQuaternion: Quaternion,
  meshPosition: Vector3,
  cameraPosition: Vector3,
  scratch: ViewAlignmentScratch,
  target: ViewAlignment,
): ViewAlignment {
  scratch.viewDir.copy(cameraPosition).sub(meshPosition);
  const distance = scratch.viewDir.length();
  if (distance > 1e-5) {
    scratch.viewDir.multiplyScalar(1 / distance);
  } else {
    scratch.viewDir.set(0, 0, 1);
  }

  scratch.normal.set(0, 0, 1).applyQuaternion(meshQuaternion);
  const facing = Math.max(scratch.normal.dot(scratch.viewDir), 0);

  scratch.tangent.set(1, 0, 0).applyQuaternion(meshQuaternion);
  scratch.bitangent.set(0, 1, 0).applyQuaternion(meshQuaternion);

  scratch.projected.copy(scratch.viewDir).addScaledVector(scratch.normal, -facing);
  let viewX = 0;
  let viewY = 0;
  const planeLength = scratch.projected.length();
  if (planeLength > 1e-5) {
    scratch.projected.multiplyScalar(1 / planeLength);
    viewX = scratch.projected.dot(scratch.tangent);
    viewY = scratch.projected.dot(scratch.bitangent);
    const norm = Math.hypot(viewX, viewY);
    if (norm > 1e-5) {
      viewX /= norm;
      viewY /= norm;
    } else {
      viewX = 0;
      viewY = 0;
    }
  }

  target.x = Number.isFinite(viewX) ? viewX : 0;
  target.y = Number.isFinite(viewY) ? viewY : 0;
  const clampedFacing = Number.isFinite(facing) ? Math.min(Math.max(facing, 0), 1) : 0;
  target.z = clampedFacing;
  return target;
}
