import * as THREE from 'three';
import type { CameraState } from './cameraManager.js';
import { getCachedCameraBasis } from './cameraManager.js';
import type { MeshFactoryState } from './meshFactory.js';

/**
 * UI overlays and HUD management
 * Extracted from threeRenderer.ts for SRP compliance
 */

export interface OverlayState {
  GPU_BILLBOARD: boolean;
}

export interface OverlayManager {
  createOverlayState(): OverlayState;
  updateBillboardOverlays(
    healthBarMeshes: Map<number, THREE.Object3D>,
    cameraState: CameraState,
    factoryState: MeshFactoryState,
    overlayState: OverlayState
  ): void;
  disposeOverlays(overlayState: OverlayState): void;
}

/**
 * Creates the overlay state
 */
export function createOverlayState(): OverlayState {
  return {
    GPU_BILLBOARD: true // Use shader-based billboarding for health bars
  };
}

/**
 * Updates billboard overlays to face the camera
 */
export function updateBillboardOverlays(
  healthBarMeshes: Map<number, THREE.Object3D>,
  cameraState: CameraState,
  factoryState: MeshFactoryState,
  overlayState: OverlayState
): void {
  if (overlayState.GPU_BILLBOARD) {
    // Prefer cached camera basis attached by the renderer to avoid redundant
    // matrix computations. Fallback to computing basis from camera if not present.
    // Prefer cached camera basis attached by renderer, fallback to computing it
    const cb = getCachedCameraBasis(cameraState.camera);
    const camRight = new THREE.Vector3();
    const camUp = new THREE.Vector3();
    if (cb) {
      camRight.copy(cb.right);
      camUp.copy(cb.up);
    } else {
      // Compute forward then derive right/up
      const forward = new THREE.Vector3();
      cameraState.camera.getWorldDirection(forward);
      camRight.crossVectors(cameraState.camera.up, forward).normalize();
      camUp.copy(cameraState.camera.up).normalize();
    }

    for (const mat of factoryState.billboardMaterials) {
      if (mat.uniforms) {
        if (mat.uniforms.cameraRight) (mat.uniforms.cameraRight.value as THREE.Vector3).copy(camRight);
        if (mat.uniforms.cameraUp) (mat.uniforms.cameraUp.value as THREE.Vector3).copy(camUp);
      }
    }
  } else {
    // Use CPU-based billboarding - update bar quaternions to face camera
    const cb2 = getCachedCameraBasis(cameraState.camera);
    if (cb2) {
      const m = new THREE.Matrix4();
      m.makeBasis(cb2.right.clone(), cb2.up.clone(), cb2.forward?.clone() ?? new THREE.Vector3().crossVectors(cb2.right, cb2.up));
      for (const bar of healthBarMeshes.values()) {
        bar.quaternion.setFromRotationMatrix(m);
      }
    } else {
      const cameraMatrix = new THREE.Matrix4().extractRotation(cameraState.camera.matrixWorld);
      for (const bar of healthBarMeshes.values()) {
        bar.quaternion.setFromRotationMatrix(cameraMatrix);
      }
    }
  }
}

/**
 * Handles window resize for overlay elements
 */
export function handleOverlayResize(_width: number, _height: number): void {
  // Currently no overlay-specific resize handling needed
  // This function exists for future overlay features that might need resize handling
}

/**
 * Updates overlay positions and visibility
 */
export function updateOverlayPositions(
  _overlayState: OverlayState,
  _cameraDistance: number
): void {
  // Scale overlay elements based on camera distance if needed (placeholder)
}

/**
 * Disposes overlay resources
 */
export function disposeOverlays(_overlayState: OverlayState): void {
  // Currently no overlay-specific resources to dispose
  // This function exists for completeness and future extensibility
}

/**
 * Default overlay manager implementation
 */
export const overlayManager: OverlayManager = {
  createOverlayState,
  updateBillboardOverlays,
  disposeOverlays
};

/**
 * Utility functions for overlay management
 */
export const OverlayUtils = {
  handleOverlayResize,
  updateOverlayPositions
};

/**
 * Updates billboard health bar orientations to face the camera.
 * @param bars - Array of billboard health bar objects.
 * @param camera - The active camera.
 */
export function updateBillboardBars(bars: THREE.Object3D[], camera: THREE.Camera) {
  const cb = getCachedCameraBasis(camera);
  if (cb) {
    const m = new THREE.Matrix4();
    m.makeBasis(cb.right.clone(), cb.up.clone(), cb.forward?.clone() ?? new THREE.Vector3().crossVectors(cb.right, cb.up));
    for (const bar of bars) bar.quaternion.setFromRotationMatrix(m);
    return;
  }
  const cameraMatrix = new THREE.Matrix4().extractRotation(camera.matrixWorld);
  for (const bar of bars) bar.quaternion.setFromRotationMatrix(cameraMatrix);
}