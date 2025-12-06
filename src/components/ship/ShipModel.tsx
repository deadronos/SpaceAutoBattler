import { useEffect, useMemo } from 'react';
import { Color, Group, Material, Mesh, Object3D, MeshStandardMaterial } from 'three';
import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { useGLTF } from '@react-three/drei';
import type { ShipHull } from '../../types/index.js';
import type { MaterialWithUserData } from '../../types/renderer.js';
import { SHIP_MODEL_PATHS } from '../../assets/ships.js';

/** Interface for materials that have color properties */
interface ColoredMaterial extends Material {
  color: Color;
  emissive?: Color;
}

/**
 * Resolved metadata for a hull material instance.
 */
export interface HullMaterial {
  material: ColoredMaterial;
  originalColor: Color;
  originalEmissive?: Color;
}

/**
 * Resolves the URL for a given ship model key.
 *
 * @param {string} [modelKey] - The key for the ship model.
 * @returns {string} The resolved URL.
 */
export function resolveModelPath(modelKey?: string): string {
  const key = (modelKey ?? 'fighter') as keyof typeof SHIP_MODEL_PATHS;
  return SHIP_MODEL_PATHS[key] ?? SHIP_MODEL_PATHS.fighter;
}

/**
 * Hook to load and clone a GLTF ship model.
 *
 * @param {string} [modelKey] - The model key to load.
 * @returns {{ scene: Group | null; hasValidPath: boolean }} The loaded scene and validity flag.
 */
export function useShipModel(modelKey?: string): {
  scene: Group | null;
  hasValidPath: boolean;
} {
  const modelPath = resolveModelPath(modelKey);
  const hasValidPath = typeof modelPath === 'string' && modelPath.length > 0;

  const gltf = hasValidPath ? (useGLTF(modelPath) as GLTF) : null;
  const scene = useMemo(() => (gltf ? gltf.scene.clone(true) : null), [gltf?.scene]);

  return { scene, hasValidPath };
}

/** Type guard to check if an Object3D is a Mesh with material */
function isMeshWithMaterial(obj: Object3D): obj is Mesh {
  return 'isMesh' in obj && (obj as Mesh).isMesh && 'material' in obj;
}

/** Type guard to check if a material has a color property */
function isColoredMaterial(m: Material): m is ColoredMaterial {
  return 'color' in m && (m as ColoredMaterial).color instanceof Color;
}

/**
 * Hook to extract and track materials from a ship model scene.
 *
 * @param {Group | null} scene - The scene to traverse.
 * @returns {React.MutableRefObject<HullMaterial[]>} A ref containing the list of materials.
 */
export function useHullMaterials(
  scene: Group | null,
): React.MutableRefObject<HullMaterial[]> {
  const hullMaterialsRef = { current: [] as HullMaterial[] };

  useEffect(() => {
    hullMaterialsRef.current = [];
    if (!scene) return;

    scene.traverse((obj: Object3D) => {
      if (isMeshWithMaterial(obj)) {
        const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
        mats.forEach((m: Material) => {
          if (isColoredMaterial(m)) {
            // Ensure hull materials remain visible in the main pass by
            // marking them as force-write. This prevents the selective
            // bloom provider from disabling their colorWrite via
            // registration races or overly-broad group registrations.
            try {
              if (!m.userData) m.userData = {};
              (m as MaterialWithUserData).userData.__copilot_forceColorWrite = true;
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

/**
 * Applies a team-colored tint to hull materials based on shield status.
 *
 * @param {HullMaterial[]} materials - The list of materials to update.
 * @param {number} shieldFraction - Current shield fraction (0..1).
 * @param {Color} teamColor - The team color.
 * @param {number} tintThreshold - Fraction below which tint is applied.
 * @param {number} tintStrength - Strength of the tint.
 */
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

/**
 * Fallback radii for shields by hull type, used if model bounding box fails.
 */
export const FALLBACK_RADIUS_BY_HULL: Record<ShipHull, number> = {
  fighter: 1.6,
  corvette: 2.1,
  frigate: 2.8,
  destroyer: 3.4,
  carrier: 4.4,
};
