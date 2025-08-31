import * as THREE from 'three';
import type { GameState, RendererHandles } from '../types/index.js';
import { createEffectsManager } from './effects.js';

// Import all the extracted modules
import { setupScene, updateSkyboxAnimation, disposeScene, type SceneElements } from './sceneSetup.js';
import { setupCamera, updateCameraPosition, handleResize, setCameraDistance, getCameraDistance, CameraUtils, type CameraState } from './cameraManager.js';
import { createMeshFactoryState, meshFactory, type MeshFactoryState } from './meshFactory.js';
import { createShieldEffectState, shieldEffect, type ShieldEffectState } from './effects/shieldEffect.js';
import { createSynchronizerState, createSynchronizerGroups, syncEntities, updateTransforms, type SynchronizerState, type SynchronizerGroups } from './synchronizer.js';
import { createOverlayState, updateBillboardOverlays, OverlayUtils, type OverlayState } from './overlay.js';

/**
 * Thin orchestrator that coordinates all renderer modules
 * This replaces the monolithic threeRenderer.ts with a modular architecture
 */
export function createThreeRenderer(state: GameState, canvas: HTMLCanvasElement): RendererHandles {
  // Core Three.js setup
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

  // Initialize all module states
  const sceneElements = setupScene(state);
  const cameraState = setupCamera(state);
  const meshFactoryState = createMeshFactoryState();
  const shieldEffectState = createShieldEffectState();
  const syncState = createSynchronizerState();
  const groups = createSynchronizerGroups();
  const overlayState = createOverlayState();

  // Add groups to scene
  sceneElements.scene.add(groups.shipsGroup);
  sceneElements.scene.add(groups.bulletsGroup);
  sceneElements.scene.add(groups.healthBarsGroup);
  sceneElements.scene.add(groups.shieldEffectsGroup);

  // Create effects manager (postprocessing) lazily
  let effectsManager: import('./effects.js').EffectsManager | null = null;
  try { 
    effectsManager = createEffectsManager(renderer as any, sceneElements.scene as any, cameraState.camera as any); 
  } catch (e) { 
    effectsManager = null; 
  }

  /**
   * Handles window resize
   */
  function resize() {
    const dpr = Math.min(window.devicePixelRatio, 2);
    const w = window.innerWidth;
    const h = window.innerHeight;
    
    renderer.setSize(w, h);
    renderer.setPixelRatio(dpr);
    
    handleResize(cameraState, w, h);
    OverlayUtils.handleOverlayResize(w, h);
    
    try { 
      effectsManager?.resize(w, h); 
    } catch (e) { 
      /* ignore */ 
    }
  }

  /**
   * Main render loop
   */
  function render(dt: number) {
    // Update camera position based on current rotation, distance, and target
    updateCameraPosition(cameraState);

    // Sync entities and update transforms
    syncEntities(
      state, 
      syncState, 
      groups, 
      meshFactory, 
      shieldEffect, 
      meshFactoryState, 
      shieldEffectState
    );
    updateTransforms(
      state, 
      syncState, 
      meshFactory, 
      shieldEffect, 
      shieldEffectState
    );

    // Ensure no health bar remained parented to a ship (re-parent to healthBarsGroup)
    // This guarantees bars don't inherit ship rotation.
    for (const [id, bar] of syncState.healthBarMeshes) {
      if (bar.parent !== groups.healthBarsGroup) {
        try {
          if (bar.parent) bar.parent.remove(bar);
        } catch (e) { /* ignore */ }
        groups.healthBarsGroup.add(bar);
      }
    }

    // Update billboard overlays to face the camera
    updateBillboardOverlays(
      syncState.healthBarMeshes,
      cameraState,
      meshFactoryState,
      overlayState
    );

    // Update animated skybox
    updateSkyboxAnimation(sceneElements, dt);

    // Update overlay positions based on camera distance
    OverlayUtils.updateOverlayPositions(overlayState, cameraState.distance);

    // Prefer postprocessing composer when available
    if (effectsManager && effectsManager.initDone) {
      try {
        effectsManager.render(dt);
        return;
      } catch (e) {
        console.warn('Effects manager render failed, falling back to default renderer', e);
      }
    }

    // Render the scene
    renderer.render(sceneElements.scene, cameraState.camera);
  }

  /**
   * Cleanup and dispose resources
   */
  function dispose() {
    window.removeEventListener('resize', resize);
    
    try { 
      effectsManager?.dispose(); 
    } catch (e) { 
      /* ignore */ 
    }
    
    renderer.dispose();
    
    // Dispose all module resources
    disposeScene(sceneElements);
    meshFactory.disposeMeshFactory(meshFactoryState);
    
    // Clear synchronizer state
    syncState.shipMeshes.clear();
    syncState.bulletMeshes.clear();
    syncState.healthBarMeshes.clear();
    syncState.shieldEffectMeshes.clear();
  }

  // Set up resize listener and initial size
  window.addEventListener('resize', resize);
  resize();

  // Return the renderer handles with the same interface as before
  return {
    initDone: true,
    resize,
    render,
    dispose,
    cameraRotation: cameraState.rotation,
    // Expose camera distance as getter/setter so external callers can adjust it.
    get cameraDistance() { 
      return getCameraDistance(cameraState); 
    },
    set cameraDistance(v: number) { 
      setCameraDistance(cameraState, v); 
    },
    cameraTarget: cameraState.target,
  };
}

/**
 * Updates the orientation of health/shield bars to face the camera.
 * This function is kept for backward compatibility with other modules.
 * @param bars - Array of health/shield bar meshes.
 * @param camera - The active camera.
 */
export function updateBillboardBars(bars: THREE.Object3D[], camera: THREE.Camera) {
  const cameraMatrix = new THREE.Matrix4().extractRotation(camera.matrixWorld);

  for (const bar of bars) {
    bar.quaternion.setFromRotationMatrix(cameraMatrix);
  }
}