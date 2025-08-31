import * as THREE from 'three';
import type { CameraState } from './cameraManager.js';
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
    // Update shader uniforms with camera basis vectors for all billboard materials
    const camRight = new THREE.Vector3();
    const camUp = new THREE.Vector3();
    
    cameraState.camera.getWorldDirection(camRight); // forward
    // cameraRight is cross(forward, up)
    const worldUp = new THREE.Vector3(0, 1, 0);
    camRight.crossVectors(cameraState.camera.up, cameraState.camera.getWorldDirection(new THREE.Vector3())).normalize();
    camUp.copy(cameraState.camera.up).normalize();
    
    for (const mat of factoryState.billboardMaterials) {
      if (mat.uniforms) {
        if (mat.uniforms.cameraRight) (mat.uniforms.cameraRight.value as THREE.Vector3).copy(camRight);
        if (mat.uniforms.cameraUp) (mat.uniforms.cameraUp.value as THREE.Vector3).copy(camUp);
      }
    }
  } else {
    // Use CPU-based billboarding - update bar quaternions to face camera
    const cameraMatrix = new THREE.Matrix4().extractRotation(cameraState.camera.matrixWorld);
    
    for (const bar of healthBarMeshes.values()) {
      bar.quaternion.setFromRotationMatrix(cameraMatrix);
    }
  }
}

/**
 * Handles window resize for overlay elements
 */
export function handleOverlayResize(width: number, height: number): void {
  // Currently no overlay-specific resize handling needed
  // This function exists for future overlay features that might need resize handling
}

/**
 * Updates overlay positions and visibility
 */
export function updateOverlayPositions(
  overlayState: OverlayState,
  cameraDistance: number
): void {
  // Scale overlay elements based on camera distance if needed
  // This function exists for future overlay features that might need position updates
}

/**
 * Disposes overlay resources
 */
export function disposeOverlays(overlayState: OverlayState): void {
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