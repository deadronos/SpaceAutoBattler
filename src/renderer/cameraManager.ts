import * as THREE from 'three';
import type { GameState } from '../types/index.js';
import { RendererConfig } from '../config/rendererConfig.js';

/**
 * Camera management and controls
 * Extracted from threeRenderer.ts for SRP compliance
 */

export interface CameraState {
  camera: THREE.PerspectiveCamera;
  rotation: { x: number; y: number; z: number };
  target: { x: number; y: number; z: number };
  distance: number;
}

export interface CameraManager {
  setupCamera(state: GameState): CameraState;
  updateCameraPosition(cameraState: CameraState): void;
  handleResize(cameraState: CameraState, width: number, height: number): void;
  setCameraDistance(cameraState: CameraState, distance: number): void;
  getCameraDistance(cameraState: CameraState): number;
  disposeCamera(cameraState: CameraState): void;
}

/**
 * Creates and configures the camera
 */
export function setupCamera(state: GameState): CameraState {
  const camera = new THREE.PerspectiveCamera(
    RendererConfig.camera.fov,
    1, // Will be updated on resize
    RendererConfig.camera.near,
    RendererConfig.camera.far
  );

  const rotation = {
    x: RendererConfig.camera.rotation.pitch,
    y: RendererConfig.camera.rotation.yaw,
    z: RendererConfig.camera.rotation.roll
  };

  const target = {
    x: state.simConfig.simBounds.width / 2,
    y: state.simConfig.simBounds.height / 2,
    z: state.simConfig.simBounds.depth / 2
  };

  const distance = RendererConfig.camera.cameraZ;

  const cameraState: CameraState = {
    camera,
    rotation,
    target,
    distance
  };

  // Set initial camera position
  updateCameraPosition(cameraState);

  return cameraState;
}

/**
 * Updates camera position based on spherical coordinates
 */
export function updateCameraPosition(cameraState: CameraState): void {
  const { camera, rotation, target, distance } = cameraState;

  const x = target.x + distance * Math.cos(rotation.y) * Math.cos(rotation.x);
  const y = target.y + distance * Math.sin(rotation.x);
  const z = target.z + distance * Math.sin(rotation.y) * Math.cos(rotation.x);

  camera.position.set(x, y, z);
  camera.lookAt(target.x, target.y, target.z);
}

/**
 * Handles window resize and updates camera aspect ratio
 */
export function handleResize(cameraState: CameraState, width: number, height: number): void {
  const { camera } = cameraState;
  
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  
  // Update camera position after aspect ratio change
  updateCameraPosition(cameraState);
}

/**
 * Sets the camera distance and updates position
 */
export function setCameraDistance(cameraState: CameraState, distance: number): void {
  cameraState.distance = distance;
  updateCameraPosition(cameraState);
}

/**
 * Gets the current camera distance
 */
export function getCameraDistance(cameraState: CameraState): number {
  return cameraState.distance;
}

/**
 * Updates camera rotation and position
 */
export function setCameraRotation(cameraState: CameraState, rotation: { x?: number; y?: number; z?: number }): void {
  if (rotation.x !== undefined) cameraState.rotation.x = rotation.x;
  if (rotation.y !== undefined) cameraState.rotation.y = rotation.y;
  if (rotation.z !== undefined) cameraState.rotation.z = rotation.z;
  updateCameraPosition(cameraState);
}

/**
 * Updates camera target and position
 */
export function setCameraTarget(cameraState: CameraState, target: { x?: number; y?: number; z?: number }): void {
  if (target.x !== undefined) cameraState.target.x = target.x;
  if (target.y !== undefined) cameraState.target.y = target.y;
  if (target.z !== undefined) cameraState.target.z = target.z;
  updateCameraPosition(cameraState);
}

/**
 * Gets camera basis vectors for billboard rendering
 */
export function getCameraBasisVectors(cameraState: CameraState): { right: THREE.Vector3; up: THREE.Vector3 } {
  const { camera } = cameraState;
  
  const camRight = new THREE.Vector3();
  const camUp = new THREE.Vector3();
  
  // Get camera forward direction
  camera.getWorldDirection(camRight); // This gets forward, we'll compute right from it
  
  // Calculate camera right vector: cross(up, forward)
  const worldUp = new THREE.Vector3(0, 1, 0);
  camRight.crossVectors(camera.up, camera.getWorldDirection(new THREE.Vector3())).normalize();
  camUp.copy(camera.up).normalize();
  
  return { right: camRight, up: camUp };
}

/**
 * Gets the camera matrix for billboard calculations
 */
export function getCameraMatrix(cameraState: CameraState): THREE.Matrix4 {
  return new THREE.Matrix4().extractRotation(cameraState.camera.matrixWorld);
}

/**
 * Disposes camera resources (minimal cleanup needed)
 */
export function disposeCamera(cameraState: CameraState): void {
  // Cameras don't have resources that need explicit disposal
  // This function exists for completeness and future extensibility
}

/**
 * Default camera manager implementation
 */
export const cameraManager: CameraManager = {
  setupCamera,
  updateCameraPosition,
  handleResize,
  setCameraDistance,
  getCameraDistance,
  disposeCamera
};

/**
 * Utility functions for camera calculations
 */
export const CameraUtils = {
  updateCameraPosition,
  setCameraRotation,
  setCameraTarget,
  getCameraBasisVectors,
  getCameraMatrix
};