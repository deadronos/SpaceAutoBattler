import { useEffect, type MutableRefObject } from 'react';
import type { Material, Mesh } from 'three';

interface CopilotMeshUserData {
  __copilot_origMaterial?: Material;
  __copilot_forcedMaterial?: Material;
}

function resolveMaterial(material: Mesh['material']): Material | null {
  if (Array.isArray(material)) {
    return (material[0] as Material | undefined) ?? null;
  }
  return material ?? null;
}

interface UseStarDiskDebugCleanupParams {
  debugEnabled: boolean;
  meshRef: MutableRefObject<Mesh | null>;
  removeDebugOverlay: () => void;
}

export function useStarDiskDebugCleanup({
  debugEnabled,
  meshRef,
  removeDebugOverlay,
}: UseStarDiskDebugCleanupParams): void {
  useEffect(() => {
    if (debugEnabled) {
      return;
    }
    const mesh = meshRef.current;
    if (!mesh) return;

    const userData = (mesh.userData ?? {}) as CopilotMeshUserData;
    const originalMaterial = userData.__copilot_origMaterial;
    if (originalMaterial && mesh.material !== originalMaterial) {
      const currentMaterial = resolveMaterial(mesh.material);
      currentMaterial?.dispose();
      mesh.material = originalMaterial;
      delete userData.__copilot_forcedMaterial;
      delete userData.__copilot_origMaterial;
    }

    try {
      if (typeof mesh.renderOrder === 'number') mesh.renderOrder = 0;
    } catch {
      /* ignore */
    }

    const material = resolveMaterial(mesh.material);
    if (material) {
      if (typeof material.depthTest === 'boolean') {
        material.depthTest = true;
      }
      if (typeof material.depthWrite === 'boolean') {
        material.depthWrite = true;
      }
    }
    removeDebugOverlay();
  }, [debugEnabled, meshRef, removeDebugOverlay]);
}
