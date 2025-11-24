/**
 * Material colorWrite management utilities for the bloom system.
 *
 * Handles preservation and modification of material colorWrite flags
 * to support selective bloom rendering without writing to the main color buffer.
 */

import type { Object3D, Mesh, Material } from 'three';
import { LEGACY_USER_DATA_KEYS } from './constants.js';
import { isMesh, safeTraverse } from './layerMaskManager.js';

/**
 * Check if a material has the force-write flag set.
 * Materials with this flag should not have their colorWrite modified.
 *
 * @param material - The material to check
 * @returns True if the material has force-write enabled
 */
export function hasForceColorWrite(material: Material): boolean {
  const userData = (material as { userData?: Record<string, unknown> }).userData;
  return Boolean(userData?.[LEGACY_USER_DATA_KEYS.forceColorWrite]);
}

/**
 * Get all materials from a mesh as an array.
 *
 * @param mesh - The mesh to get materials from
 * @returns Array of materials (single material wrapped in array)
 */
export function getMaterials(mesh: Mesh): Material[] {
  if (Array.isArray(mesh.material)) {
    return mesh.material;
  }
  return mesh.material ? [mesh.material] : [];
}

/**
 * Save the original colorWrite values for all materials on an object.
 * Values are stored in child.userData for later restoration.
 *
 * @param obj - The object to save colorWrite states for
 */
export function saveColorWriteState(obj: Object3D): void {
  safeTraverse(obj, (child) => {
    if (!isMesh(child)) return;

    const materials = getMaterials(child);
    const origs: Array<boolean | undefined> = [];

    for (const mat of materials) {
      if (mat && typeof mat === 'object' && 'colorWrite' in mat) {
        origs.push(typeof mat.colorWrite === 'boolean' ? mat.colorWrite : undefined);
      } else {
        origs.push(undefined);
      }
    }

    if (!child.userData) {
      child.userData = {};
    }
    child.userData[LEGACY_USER_DATA_KEYS.origColorWrite] = origs;
  });
}

/**
 * Apply bloom-specific colorWrite settings to an object's materials.
 * When enabled, transparent materials get colorWrite=false to prevent
 * them from writing to the main color buffer.
 *
 * @param obj - The object to apply colorWrite changes to
 * @param enabled - Whether bloom is enabled (true = apply, false = noop)
 */
export function applyBloomColorWrite(obj: Object3D, enabled: boolean): void {
  if (!enabled) return;

  safeTraverse(obj, (child) => {
    if (!isMesh(child)) return;

    const materials = getMaterials(child);

    for (const mat of materials) {
      if (!mat || typeof mat !== 'object') continue;

      // Skip materials marked with force-write
      if (hasForceColorWrite(mat)) continue;

      // Only modify transparent materials
      const isTransparent = 'transparent' in mat && mat.transparent === true;
      if (isTransparent && 'colorWrite' in mat) {
        (mat as { colorWrite: boolean }).colorWrite = false;
      }
    }
  });
}

/**
 * Restore the original colorWrite values for all materials on an object.
 * Cleans up the userData keys after restoration.
 *
 * @param obj - The object to restore colorWrite states for
 */
export function restoreColorWriteState(obj: Object3D): void {
  safeTraverse(obj, (child) => {
    if (!isMesh(child)) return;

    const materials = getMaterials(child);
    const origs = child.userData?.[LEGACY_USER_DATA_KEYS.origColorWrite] as Array<boolean | undefined> | undefined;

    if (Array.isArray(origs)) {
      for (let i = 0; i < materials.length; i++) {
        const mat = materials[i];
        const orig = origs[i];
        if (typeof orig === 'boolean' && mat && typeof mat === 'object' && 'colorWrite' in mat) {
          (mat as { colorWrite: boolean }).colorWrite = orig;
        }
      }
    }

    // Clean up the stored key
    if (child.userData) {
      delete child.userData[LEGACY_USER_DATA_KEYS.origColorWrite];
    }
  });
}

/**
 * Synchronize colorWrite state for all objects when bloom enabled state changes.
 * When enabled, applies bloom colorWrite settings.
 * When disabled, restores original colorWrite values.
 *
 * @param objects - Iterable of objects to synchronize
 * @param enabled - Whether bloom is enabled
 */
export function syncColorWriteForObjects(objects: Iterable<Object3D>, enabled: boolean): void {
  for (const obj of objects) {
    safeTraverse(obj, (child) => {
      if (!isMesh(child)) return;

      const materials = getMaterials(child);
      const origs = child.userData?.[LEGACY_USER_DATA_KEYS.origColorWrite] as Array<boolean | undefined> | undefined;

      if (enabled) {
        // Apply colorWrite=false for transparent materials
        for (const mat of materials) {
          if (!mat || typeof mat !== 'object') continue;
          if (hasForceColorWrite(mat)) continue;

          const isTransparent = 'transparent' in mat && mat.transparent === true;
          if (isTransparent && 'colorWrite' in mat) {
            (mat as { colorWrite: boolean }).colorWrite = false;
          }
        }
      } else {
        // Restore original values
        if (Array.isArray(origs)) {
          for (let i = 0; i < materials.length; i++) {
            const mat = materials[i];
            const orig = origs[i];
            if (typeof orig === 'boolean' && mat && typeof mat === 'object' && 'colorWrite' in mat) {
              (mat as { colorWrite: boolean }).colorWrite = orig;
            }
          }
        }
      }
    });
  }
}

/**
 * Check if an object has saved colorWrite state.
 *
 * @param obj - The object to check
 * @returns True if the object has saved colorWrite data
 */
export function hasSavedColorWriteState(obj: Object3D): boolean {
  return Array.isArray(obj.userData?.[LEGACY_USER_DATA_KEYS.origColorWrite]);
}
