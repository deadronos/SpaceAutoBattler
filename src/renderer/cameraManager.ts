import * as THREE from 'three';
// OrbitControls lives in three/examples - import lazily to avoid bundling issues in tests
let OrbitControls: unknown = null;
try {
  OrbitControls = require('three/examples/jsm/controls/OrbitControls').OrbitControls;
} catch {
  OrbitControls = null;
}
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
  // Optional orbit controls helper
  attachOrbitControls?: (
    cameraState: CameraState,
    domElement: HTMLElement,
    opts?: { enableRotate?: boolean; enablePan?: boolean; enableZoom?: boolean },
  ) => { dispose: () => void } | null;
}

/**
 * Creates and configures the camera
 */
export function setupCamera(state: GameState): CameraState {
  const camera = new THREE.PerspectiveCamera(
    RendererConfig.camera.fov,
    1, // Will be updated on resize
    RendererConfig.camera.near,
    RendererConfig.camera.far,
  );

  const rotation = {
    x: RendererConfig.camera.rotation.pitch,
    y: RendererConfig.camera.rotation.yaw,
    z: RendererConfig.camera.rotation.roll,
  };

  const target = {
    x: state.simConfig.simBounds.width / 2,
    y: state.simConfig.simBounds.height / 2,
    z: state.simConfig.simBounds.depth / 2,
  };

  const distance = RendererConfig.camera.cameraZ;

  const cameraState: CameraState = {
    camera,
    rotation,
    target,
    distance,
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
 * Attach OrbitControls to a CameraState and DOM element.
 * This will synchronize OrbitControls' target/distance with CameraState so other
 * systems reading CameraState remain compatible.
 */
export function attachOrbitControls(
  cameraState: CameraState,
  domElement: HTMLElement,
  opts?: { enableRotate?: boolean; enablePan?: boolean; enableZoom?: boolean },
): { dispose: () => void } | null {
  if (!OrbitControls) return null;
  const ControlsCtor = OrbitControls as unknown as {
    new (camera: THREE.Camera, domElement: HTMLElement): {
      enableDamping: boolean;
      enableRotate: boolean;
      enablePan: boolean;
      enableZoom: boolean;
      target: THREE.Vector3;
      update: () => void;
      addEventListener: (name: string, fn: () => void) => void;
      removeEventListener: (name: string, fn: () => void) => void;
      dispose: () => void;
    };
  };
  const controls = new ControlsCtor(cameraState.camera, domElement);
  controls.enableDamping = true;
  controls.enableRotate = opts?.enableRotate ?? true;
  controls.enablePan = opts?.enablePan ?? true;
  controls.enableZoom = opts?.enableZoom ?? true;
  // Initialize controls to cameraState
  controls.target.set(cameraState.target.x, cameraState.target.y, cameraState.target.z);
  // Map distance to controls' position by placing camera on negative Z in local space
  controls.update();

  // On change, sync back to cameraState
  const onChange = () => {
    // Update target
    cameraState.target.x = controls.target.x;
    cameraState.target.y = controls.target.y;
    cameraState.target.z = controls.target.z;
    // Recompute distance from camera to target
    cameraState.distance = cameraState.camera.position.distanceTo(controls.target);
  };

  controls.addEventListener('change', onChange);

  return {
    dispose() {
      try {
        controls.removeEventListener('change', onChange);
        controls.dispose();
      } catch {
        // ignore
      }
    },
  };
}

/**
 * Attach OrbitControls to a raw camera and simple mutable state objects used by
 * legacy renderer code. This avoids the need to refactor large renderer files.
 */
export function attachOrbitControlsToRaw(
  camera: THREE.Camera,
  cameraTarget: { x: number; y: number; z: number },
  cameraRotation: { x: number; y: number; z: number },
  getDistance: () => number,
  setDistance: (v: number) => void,
  domElement: HTMLElement,
  opts?: { enableRotate?: boolean; enablePan?: boolean; enableZoom?: boolean },
): { dispose: () => void } | null {
  if (!OrbitControls) return null;
  const ControlsCtor = OrbitControls as unknown as {
    new (camera: THREE.Camera, domElement: HTMLElement): {
      enableDamping: boolean;
      enableRotate: boolean;
      enablePan: boolean;
      enableZoom: boolean;
      target: THREE.Vector3;
      update: () => void;
      addEventListener: (name: string, fn: () => void) => void;
      removeEventListener: (name: string, fn: () => void) => void;
      dispose: () => void;
    };
  };
  const controls = new ControlsCtor(camera as unknown as THREE.PerspectiveCamera, domElement);
  controls.enableDamping = true;
  controls.enableRotate = opts?.enableRotate ?? true;
  controls.enablePan = opts?.enablePan ?? true;
  controls.enableZoom = opts?.enableZoom ?? true;
  controls.target.set(cameraTarget.x, cameraTarget.y, cameraTarget.z);
  controls.update();

  const onChange = () => {
    cameraTarget.x = controls.target.x;
    cameraTarget.y = controls.target.y;
    cameraTarget.z = controls.target.z;
    // update rotation from camera position relative to target
    const camPos = (camera as unknown as THREE.PerspectiveCamera).position;
    const dx = camPos.x - controls.target.x;
    const dy = camPos.y - controls.target.y;
    const dz = camPos.z - controls.target.z;
    // approximate spherical angles
    cameraRotation.x = Math.atan2(dy, Math.sqrt(dx * dx + dz * dz));
    cameraRotation.y = Math.atan2(dz, dx);
    setDistance(camPos.distanceTo(controls.target));
  };

  controls.addEventListener('change', onChange);

  return {
    dispose() {
      try {
        controls.removeEventListener('change', onChange);
        controls.dispose();
      } catch {
        // ignore
      }
    },
  };
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
export function setCameraRotation(
  cameraState: CameraState,
  rotation: { x?: number; y?: number; z?: number },
): void {
  if (rotation.x !== undefined) cameraState.rotation.x = rotation.x;
  if (rotation.y !== undefined) cameraState.rotation.y = rotation.y;
  if (rotation.z !== undefined) cameraState.rotation.z = rotation.z;
  updateCameraPosition(cameraState);
}

/**
 * Updates camera target and position
 */
export function setCameraTarget(
  cameraState: CameraState,
  target: { x?: number; y?: number; z?: number },
): void {
  if (target.x !== undefined) cameraState.target.x = target.x;
  if (target.y !== undefined) cameraState.target.y = target.y;
  if (target.z !== undefined) cameraState.target.z = target.z;
  updateCameraPosition(cameraState);
}

/**
 * Gets camera basis vectors for billboard rendering
 */
export function getCameraBasisVectors(cameraState: CameraState): {
  right: THREE.Vector3;
  up: THREE.Vector3;
} {
  const { camera } = cameraState;
  // Prefer cached basis when available
  try {
    const cached = getCachedCameraBasis(camera);
    if (cached) return { right: cached.right.clone(), up: cached.up.clone() };
  } catch {
    /* ignore and fallback */
  }

  const camRight = new THREE.Vector3();
  const camUp = new THREE.Vector3();
  // Get camera forward direction
  const forward = new THREE.Vector3();
  camera.getWorldDirection(forward);
  // Calculate camera right vector: right = forward x worldUp
  const worldUp = new THREE.Vector3(0, 1, 0);
  camRight.crossVectors(forward, worldUp).normalize();
  camUp.copy(camera.up).normalize();

  return { right: camRight, up: camUp };
}

/**
 * Gets the camera matrix for billboard calculations
 */
export function getCameraMatrix(cameraState: CameraState): THREE.Matrix4 {
  // Prefer constructing from cached basis if available to avoid extractRotation
  try {
    const cached = getCachedCameraBasis(cameraState.camera);
    if (cached) {
      const fwd = cached.forward
        ? cached.forward.clone()
        : new THREE.Vector3().crossVectors(cached.right, cached.up).normalize();
      const m = new THREE.Matrix4();
      m.makeBasis(cached.right.clone(), cached.up.clone(), fwd);
      return m;
    }
  } catch {
    /* ignore */
  }
  return new THREE.Matrix4().extractRotation(cameraState.camera.matrixWorld);
}

/**
 * Disposes camera resources (minimal cleanup needed)
 */
export function disposeCamera(_cameraState: CameraState): void {
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
  disposeCamera,
  attachOrbitControls,
};

// Also export the raw attach helper for legacy code
export const CameraManagerExtras = {
  attachOrbitControlsToRaw,
};

/**
 * Utility functions for camera calculations
 */
export const CameraUtils = {
  updateCameraPosition,
  setCameraRotation,
  setCameraTarget,
  getCameraBasisVectors,
  getCameraMatrix,
};

/**
 * Safely read a cached camera basis from camera.userData.__cameraBasis.
 * Returns { right, up, forward? } when present and well-formed, otherwise null.
 * This centralizes runtime checks and avoids repeated narrowing logic across the codebase.
 */
export type CameraBasis = { right: THREE.Vector3; up: THREE.Vector3; forward?: THREE.Vector3 };

export function getCachedCameraBasis(camera: THREE.Camera): CameraBasis | null {
  // userData is of type any-ish; narrow safely without using `any`
  const ud = (camera as unknown as { userData?: unknown }).userData;
  if (!ud || typeof ud !== 'object') return null;

  const b = (ud as Record<string, unknown>)['__cameraBasis'];
  if (!b || typeof b !== 'object') return null;

  const right = (b as Record<string, unknown>)['right'];
  const up = (b as Record<string, unknown>)['up'];
  const forward = (b as Record<string, unknown>)['forward'];

  // Basic structural validation: check for numeric x,y,z fields
  const isVecLike = (v: unknown): v is THREE.Vector3 => {
    return (
      typeof v === 'object' &&
      v !== null &&
      'x' in (v as object) &&
      'y' in (v as object) &&
      'z' in (v as object)
    );
  };

  if (!isVecLike(right) || !isVecLike(up)) return null;

  return {
    right: right as THREE.Vector3,
    up: up as THREE.Vector3,
    forward: isVecLike(forward) ? (forward as THREE.Vector3) : undefined,
  };
}

/**
 * Safely set a cached camera basis on camera.userData.__cameraBasis.
 * Uses defensive checks to avoid throwing in environments with frozen userData
 * or restrictive proxies. Best-effort but non-critical.
 */
export function setCachedCameraBasis(camera: THREE.Camera, basis: CameraBasis): void {
  try {
    const cu = (camera as unknown as { userData?: Record<string, unknown> }).userData;
    if (cu && typeof cu === 'object') {
      (cu as Record<string, unknown>).__cameraBasis = basis;
      return;
    }
    // If userData missing or not an object, assign a fresh object
    (camera as unknown as { userData: Record<string, unknown> }).userData = {
      __cameraBasis: basis,
    };
  } catch {
    // Best-effort: do not throw if assignment fails in constrained environments
  }
}
