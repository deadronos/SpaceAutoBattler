import { useEffect, useMemo } from 'react';
import { Color } from 'three';
import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { useGLTF } from '@react-three/drei';
import type { ShipHull } from '../../types/index.js';
import { SHIP_MODEL_PATHS } from '../../assets/ships.js';

export interface HullMaterial {
  material: any;
  originalColor: Color;
  originalEmissive?: Color;
}

export function resolveModelPath(modelKey?: string): string {
  const key = (modelKey ?? 'fighter') as keyof typeof SHIP_MODEL_PATHS;
  return SHIP_MODEL_PATHS[key] ?? SHIP_MODEL_PATHS.fighter;
}

export function useShipModel(modelKey?: string): {
  scene: any | null;
  hasValidPath: boolean;
} {
  const modelPath = resolveModelPath(modelKey);
  const hasValidPath = typeof modelPath === 'string' && modelPath.length > 0;

  const gltf = hasValidPath ? (useGLTF(modelPath) as GLTF) : null;
  const scene = useMemo(() => (gltf ? gltf.scene.clone(true) : null), [gltf?.scene]);

  return { scene, hasValidPath };
}

export function useHullMaterials(
  scene: any | null,
): React.MutableRefObject<HullMaterial[]> {
  const hullMaterialsRef = { current: [] as HullMaterial[] };

  useEffect(() => {
    hullMaterialsRef.current = [];
    if (!scene) return;

    scene.traverse((obj: any) => {
      if (obj && obj.isMesh && obj.material) {
        const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
        mats.forEach((m: any) => {
          if (m && m.color && typeof m.color.clone === 'function') {
            // Ensure hull materials remain visible in the main pass by
            // marking them as force-write. This prevents the selective
            // bloom provider from disabling their colorWrite via
            // registration races or overly-broad group registrations.
            try {
              if (!m.userData) m.userData = {};
              (m.userData as any).__copilot_forceColorWrite = true;
            } catch { /* defensive: ignore odd host objects */ }
            const entry: HullMaterial = {
              material: m,
              originalColor: m.color.clone(),
            };
            if (m.emissive && typeof m.emissive.clone === 'function') {
              entry.originalEmissive = m.emissive.clone();
            }
            hullMaterialsRef.current.push(entry);
          }
        });
      }
    });
  }, [scene]);

  return hullMaterialsRef as React.MutableRefObject<HullMaterial[]>;
}

export function applyHullTint(
  materials: HullMaterial[],
  shieldFraction: number,
  teamColor: Color,
  tintThreshold: number,
  tintStrength: number,
): void {
  const applyTint = shieldFraction <= tintThreshold;

  for (const entry of materials) {
    const m = entry.material;
    if (!m || !m.color) continue;

    if (applyTint) {
      const target = entry.originalColor.clone().lerp(teamColor, tintStrength);
      m.color.copy(target);
      
      if (m.emissive && typeof m.emissive.copy === 'function') {
        m.emissive.copy(target).multiplyScalar(0.08);
      }
    } else {
      m.color.copy(entry.originalColor);
      
      if (m.emissive && entry.originalEmissive) {
        m.emissive.copy(entry.originalEmissive);
      } else if (m.emissive) {
        m.emissive.setHex(0x000000);
      }
    }
  }
}

export const FALLBACK_RADIUS_BY_HULL: Record<ShipHull, number> = {
  fighter: 1.6,
  corvette: 2.1,
  frigate: 2.8,
  destroyer: 3.4,
  carrier: 4.4,
};
