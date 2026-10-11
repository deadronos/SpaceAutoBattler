/**
 * StarSphere per-frame uniform updates.
 *
 * Owns the component's `useFrame` body: timekeeping, camera-to-disk view
 * alignment, the debug scaffolding call, and the `updateMainSequenceStarUniforms`
 * update. The component keeps the refs/scratch objects so hook call order and
 * allocation behaviour are unchanged.
 */

import type { RefObject } from 'react';
import { useFrame } from '@react-three/fiber';
import type { Camera, Euler, Mesh, ShaderMaterial, Texture, WebGLRenderer } from 'three';
import { Quaternion, Vector3 } from 'three';
import type {
  StarLightConfig,
  StarDiskHazeConfig,
  StarDiskBoundaryConfig,
} from '../config/environment.js';
import { updateMainSequenceStarUniforms } from '../renderer/starDiskMaterial.js';
import {
  computeViewAlignment,
  type ViewAlignment,
  type ViewAlignmentScratch,
} from '../renderer/starDiskOrientation.js';
import { runStarSphereDebug } from '../debug/starSphereDebug.js';

export interface StarSphereFrameParams {
  enabled: boolean;
  debugEnabled: boolean;
  camera: Camera;
  gl: WebGLRenderer;
  viewportSize: { width: number; height: number };
  visualMeshRef: RefObject<Mesh | null>;
  appliedMaterial: ShaderMaterial | null;
  organic: Texture | null;
  noise: Texture | null;
  paused: boolean;
  radius: number;
  config?: StarLightConfig;
  haze?: StarDiskHazeConfig;
  boundary?: StarDiskBoundaryConfig;
  fallbackHaze?: StarDiskHazeConfig;
  fallbackBoundary?: StarDiskBoundaryConfig;
  derivedDepthCoreRadius: number;
  baseQuaternion: Quaternion;
  viewAlignmentRef: RefObject<ViewAlignment>;
  viewScratch: ViewAlignmentScratch;
  meshWorldPosition: Vector3;
  lastTimeRef: RefObject<number>;
  accumulatedTimeRef: RefObject<number>;
}

/**
 * Register the StarSphere frame loop.
 *
 * Must be called unconditionally so hook order stays stable; the `enabled`
 * guard mirrors the original early return inside `useFrame`.
 */
export function useStarSphereFrame(params: StarSphereFrameParams): void {
  const {
    enabled,
    debugEnabled,
    camera,
    gl,
    viewportSize,
    visualMeshRef,
    appliedMaterial,
    organic,
    noise,
    paused,
    radius,
    config,
    haze,
    boundary,
    fallbackHaze,
    fallbackBoundary,
    derivedDepthCoreRadius,
    baseQuaternion,
    viewAlignmentRef,
    viewScratch,
    meshWorldPosition,
    lastTimeRef,
    accumulatedTimeRef,
  } = params;

  useFrame((state) => {
    if (!enabled) return;

    const mesh = visualMeshRef.current;

    runStarSphereDebug({
      debugEnabled,
      camera,
      mesh,
      getVisualMesh: () => visualMeshRef.current,
      appliedMaterial,
      radius,
      config,
      size: { width: state.size.width, height: state.size.height },
    });

    // Compute view alignment to compensate for camera viewing angle
    const cameraPosition = camera.position;
    if (mesh && typeof mesh.updateMatrixWorld === 'function' && cameraPosition) {
      mesh.updateMatrixWorld();
      if (mesh.matrixWorld) {
        meshWorldPosition.setFromMatrixPosition(mesh.matrixWorld);
      }
      computeViewAlignment(
        baseQuaternion, // Use baseQuaternion (Z-aligned) for view alignment calculation
        meshWorldPosition,
        cameraPosition,
        viewScratch,
        viewAlignmentRef.current,
      );
    }

    const mat = appliedMaterial;
    if (!mat) return;

    // Access camera rotation z component (roll) safely
    const rotation = (camera as Camera & { rotation?: Euler }).rotation;
    const roll = rotation?.z;
    const cameraRoll = typeof roll === 'number' && Number.isFinite(roll) ? roll : 0;

    const elapsed = state.clock.getElapsedTime();
    if (lastTimeRef.current === 0) {
      lastTimeRef.current = elapsed;
      accumulatedTimeRef.current = elapsed;
    }
    const delta = elapsed - lastTimeRef.current;
    lastTimeRef.current = elapsed;
    if (!paused) {
      accumulatedTimeRef.current += delta;
    }

    updateMainSequenceStarUniforms(mat, {
      time: accumulatedTimeRef.current,
      resolution: {
        width: Number(viewportSize.width) || Math.max(1, gl.domElement.width),
        height: Number(viewportSize.height) || Math.max(1, gl.domElement.height),
      },
      organic: organic ?? null,
      noise: noise ?? null,
      cameraRoll,
      starNorth: 0,
      viewAlignment: viewAlignmentRef.current,
      haze: haze ?? fallbackHaze,
      boundary: boundary ?? fallbackBoundary,
      depthCoreRadius: derivedDepthCoreRadius,
    });
  });
}
