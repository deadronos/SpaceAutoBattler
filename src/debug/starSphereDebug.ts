/**
 * StarSphere per-frame debug scaffolding.
 *
 * This module owns the `window.__copilot_*` hooks and the
 * `#copilot-star-screen-indicator` overlay that `StarSphere` previously
 * registered inline in its `useFrame` loop. The behaviour is unchanged: hooks
 * are registered through `registerDebugHook`/`hasDebugHook` under the `star`
 * owner so `useStarDebug`'s cleanup continues to find them.
 */

import { DoubleSide, MeshBasicMaterial, Vector3 } from 'three';
import type { Camera, Material, Mesh, ShaderMaterial } from 'three';
import type { StarLightConfig } from '../config/environment.js';
import { registerDebugHook, hasDebugHook } from './copilotDebugRegistry.js';
import { getStarDebugWindow } from './starDebugWindow.js';

interface CopilotUserData {
  __copilot_origMaterial?: Material;
  __copilot_forcedMaterial?: MeshBasicMaterial;
  __copilot_origLayerMask?: number;
}

function getCopilotUserData(mesh: Mesh): CopilotUserData {
  if (!mesh.userData) {
    mesh.userData = {};
  }
  return mesh.userData as CopilotUserData;
}

function resolveMaterial(material: Material | Material[]): Material | null {
  if (Array.isArray(material)) {
    return material[0] ?? null;
  }
  return material;
}

export interface StarSphereDebugParams {
  debugEnabled: boolean;
  camera: Camera;
  /** Visual mesh snapshot for the current frame (equivalent to `visualMeshRef.current`). */
  mesh: Mesh | null;
  /** Live accessor used by the long-lived `window` closures. */
  getVisualMesh: () => Mesh | null;
  appliedMaterial: ShaderMaterial | null;
  radius: number;
  config?: StarLightConfig;
  /** R3F canvas size used to position the screen-space indicator. */
  size: { width: number; height: number };
}

export function runStarSphereDebug({
  debugEnabled,
  camera,
  mesh,
  getVisualMesh,
  appliedMaterial,
  radius,
  config,
  size,
}: StarSphereDebugParams): void {
  if (!debugEnabled) return;

  // We conditionally enable dev/debug tools at runtime based on query parameters
  const debugWin = getStarDebugWindow();
  if (debugWin) {
    registerDebugHook(
      '__copilot_cameraPosition',
      {
        x: camera.position.x,
        y: camera.position.y,
        z: camera.position.z,
      },
      'star',
    );
    registerDebugHook(
      '__copilot_cameraRotation',
      {
        x: camera.rotation.x,
        y: camera.rotation.y,
        z: camera.rotation.z,
      },
      'star',
    );
  }

  // Handle camera rotation delta request from E2E tests
  if (
    debugWin &&
    debugWin.__copilot_rotateCameraDeltaDeg !== undefined &&
    debugWin.__copilot_rotateCameraDeltaDeg !== null
  ) {
    const deg = Number(debugWin.__copilot_rotateCameraDeltaDeg);
    if (Number.isFinite(deg)) {
      camera.rotation.y += (deg * Math.PI) / 180;
      camera.updateMatrixWorld();
      try {
        registerDebugHook('__copilot_rotateAppliedAt', Date.now(), 'star');
      } catch {
        /* ignore */
      }
    }
    try {
      registerDebugHook('__copilot_rotateCameraDeltaDeg', null, 'star');
    } catch {
      /* ignore */
    }
  }

  // Handle basic material request / setup methods on window
  if (debugWin && mesh) {
    registerDebugHook('__copilot_visualMesh', mesh, 'star');
    registerDebugHook('__copilot_appliedMaterial', appliedMaterial, 'star');
    if (!hasDebugHook('__copilot_setStarBasicMaterial')) {
      debugWin.__copilot_setStarBasicMaterial = (opts: { color?: string } = {}) => {
        try {
          const meshLocal = getVisualMesh();
          if (!meshLocal) {
            return { applied: false, reason: 'no-mesh' };
          }
          const userData = getCopilotUserData(meshLocal);
          if (!userData.__copilot_origMaterial) {
            userData.__copilot_origMaterial = resolveMaterial(meshLocal.material) ?? undefined;
          }
          const color = typeof opts.color === 'string' ? opts.color : '#ffffff';
          if (!userData.__copilot_forcedMaterial) {
            userData.__copilot_forcedMaterial = new MeshBasicMaterial({
              color,
              depthTest: false,
              depthWrite: false,
              side: DoubleSide,
            });
          } else {
            userData.__copilot_forcedMaterial.color.set(color);
          }
          meshLocal.material = userData.__copilot_forcedMaterial;
          registerDebugHook('__copilot_forceBasicMaterialActive', true, 'star');
          registerDebugHook('__copilot_forceBasicMaterialColor', color, 'star');
          registerDebugHook('__copilot_forceBasicMaterialApplied', Date.now(), 'star');
          return { applied: true };
        } catch (error) {
          return { applied: false, reason: String(error) };
        }
      };
      registerDebugHook(
        '__copilot_setStarBasicMaterial',
        debugWin.__copilot_setStarBasicMaterial,
        'star',
      );
    }

    if (!hasDebugHook('__copilot_restoreStarMaterial')) {
      debugWin.__copilot_restoreStarMaterial = () => {
        try {
          const meshLocal = getVisualMesh();
          if (!meshLocal) {
            return { restored: false, reason: 'no-mesh' };
          }
          const userData = getCopilotUserData(meshLocal);
          const originalMaterial = userData.__copilot_origMaterial;
          if (originalMaterial) {
            const forcedMaterial = resolveMaterial(meshLocal.material);
            forcedMaterial?.dispose();
            meshLocal.material = originalMaterial;
            delete userData.__copilot_origMaterial;
            delete userData.__copilot_forcedMaterial;
            registerDebugHook('__copilot_restoreOriginalStarMaterialApplied', Date.now(), 'star');
            return { restored: true };
          }
          return { restored: false, reason: 'no-orig' };
        } catch (error) {
          return { restored: false, reason: String(error) };
        }
      };
      registerDebugHook(
        '__copilot_restoreStarMaterial',
        debugWin.__copilot_restoreStarMaterial,
        'star',
      );
    }

    if (!mesh.userData) {
      mesh.userData = {};
    }
    const meshUserData = getCopilotUserData(mesh);
    if (meshUserData.__copilot_origLayerMask == null) {
      const rawLayers = mesh.layers as { mask?: number } | undefined;
      const mask = rawLayers && typeof rawLayers.mask === 'number' ? rawLayers.mask : 1;
      meshUserData.__copilot_origLayerMask = Number.isFinite(mask) ? mask : 1;
    }

    if (!hasDebugHook('__copilot_setStarLayer')) {
      debugWin.__copilot_setStarLayer = (layerIndex: unknown = 0) => {
        try {
          const meshLocal = getVisualMesh();
          if (!meshLocal) {
            return { set: false, reason: 'no-mesh' };
          }
          const value = Number(layerIndex);
          const idx = Number.isFinite(value) ? Math.max(0, Math.min(Math.floor(value), 31)) : 0;
          const layers = meshLocal.layers as
            | { set?: (layer: number) => void; mask?: number }
            | undefined;
          if (layers && typeof layers.set === 'function') {
            layers.set(idx);
          } else if (layers) {
            layers.mask = idx;
          }
          registerDebugHook('__copilot_starLayerSetAt', Date.now(), 'star');
          return { set: true, layer: idx };
        } catch (error) {
          return { set: false, reason: String(error) };
        }
      };
      registerDebugHook('__copilot_setStarLayer', debugWin.__copilot_setStarLayer, 'star');
    }

    if (!hasDebugHook('__copilot_resetStarLayer')) {
      debugWin.__copilot_resetStarLayer = () => {
        try {
          const meshLocal = getVisualMesh();
          if (!meshLocal) {
            return { reset: false, reason: 'no-mesh' };
          }
          const userData = getCopilotUserData(meshLocal);
          const orig = userData.__copilot_origLayerMask;
          if (typeof orig === 'number') {
            const layers = meshLocal.layers as
              | { mask?: number; set?: (layer: number) => void }
              | undefined;
            if (layers && typeof layers.set === 'function') {
              layers.set(orig);
            } else if (layers) {
              layers.mask = orig;
            }
          } else {
            const layers = meshLocal.layers as
              | { mask?: number; set?: (layer: number) => void }
              | undefined;
            if (layers && typeof layers.set === 'function') {
              layers.set(0);
            } else if (layers) {
              layers.mask = 0;
            }
          }
          registerDebugHook('__copilot_starLayerResetAt', Date.now(), 'star');
          return { reset: true };
        } catch (error) {
          return { reset: false, reason: String(error) };
        }
      };
      registerDebugHook('__copilot_resetStarLayer', debugWin.__copilot_resetStarLayer, 'star');
    }
  }

  // Handle persistent basic material enforcement if toggled active
  if (debugWin && debugWin.__copilot_forceBasicMaterialActive && mesh) {
    try {
      const userData = getCopilotUserData(mesh);
      if (!userData.__copilot_origMaterial) {
        userData.__copilot_origMaterial = resolveMaterial(mesh.material) ?? undefined;
      }
      if (!userData.__copilot_forcedMaterial) {
        const color =
          typeof debugWin.__copilot_forceBasicMaterialColor === 'string'
            ? debugWin.__copilot_forceBasicMaterialColor
            : '#ffffff';
        userData.__copilot_forcedMaterial = new MeshBasicMaterial({
          color,
          depthTest: false,
          depthWrite: false,
          side: DoubleSide,
        });
      } else if (typeof debugWin.__copilot_forceBasicMaterialColor === 'string') {
        userData.__copilot_forcedMaterial.color.set(debugWin.__copilot_forceBasicMaterialColor);
      }
      if (mesh.material !== userData.__copilot_forcedMaterial) {
        mesh.material = userData.__copilot_forcedMaterial;
      }
      registerDebugHook(
        '__copilot_forceBasicMaterialApplied',
        debugWin.__copilot_forceBasicMaterialApplied || Date.now(),
        'star',
      );
    } catch {
      /* ignore */
    }
  }

  // Create / position the `#copilot-star-screen-indicator` overlay
  if (mesh) {
    try {
      mesh.updateMatrixWorld();
      const meshWorldPosition = new Vector3();
      meshWorldPosition.setFromMatrixPosition(mesh.matrixWorld);
      const dirX = config?.direction?.x ?? 0;
      const dirY = config?.direction?.y ?? 0;
      const dirZ = config?.direction?.z ?? 1;
      const dir = new Vector3(dirX, dirY, dirZ).normalize();
      const pos = meshWorldPosition.clone().addScaledVector(dir, radius);
      const proj = pos.project(camera);
      const ndcX = proj.x;
      const ndcY = proj.y;
      const width = size.width;
      const height = size.height;
      const pxX = Math.round((ndcX * 0.5 + 0.5) * width);
      const pxY = Math.round((-ndcY * 0.5 + 0.5) * height);

      let el = document.getElementById('copilot-star-screen-indicator');
      if (!el) {
        el = document.createElement('div');
        el.id = 'copilot-star-screen-indicator';
        el.style.position = 'fixed';
        el.style.pointerEvents = 'none';
        el.style.width = '12px';
        el.style.height = '12px';
        el.style.borderRadius = '50%';
        el.style.background = 'rgba(255,0,0,0.9)';
        el.style.zIndex = '2147483647';
        el.style.transform = 'translate(-50%, -50%)';
        document.body.appendChild(el);
      }
      el.style.left = pxX + 'px';
      el.style.top = pxY + 'px';
      el.setAttribute('data-copilot-screen-pos', `${pxX},${pxY}`);
    } catch {
      // ignore
    }
  }
}
