/**
 * Layer mask management utilities for the bloom system.
 *
 * Handles preservation and restoration of Three.js layer masks on objects
 * when they are registered/unregistered from the bloom system.
 */

import type { Object3D, Mesh } from 'three';
import { LEGACY_USER_DATA_KEYS } from './constants.js';

/**
 * Type guard to check if an Object3D is a Mesh.
 *
 * @param obj - The object to check
 * @returns True if the object is a Mesh
 */
export function isMesh(obj: Object3D): obj is Mesh {
  return 'isMesh' in obj && (obj as Mesh).isMesh === true;
}

/**
 * Traverse an object and its children safely, calling the callback for each.
 *
 * @param obj - The root object to traverse
 * @param callback - Function to call for each object in the hierarchy
 */
export function safeTraverse(obj: Object3D, callback: (child: Object3D) => void): void {
  try {
    obj.traverse((child) => {
      try {
        callback(child);
      } catch {
        // Individual child callback errors are silently ignored
        // This matches the original behavior but could be enhanced with logging
      }
    });
  } catch {
    // Traversal itself failed - object may be in an invalid state
  }
}

/**
 * Save the original layer mask for an object and all its mesh children.
 * The mask is stored in userData for later restoration.
 *
 * @param obj - The object to save layer masks for
 */
export function saveLayerMasks(obj: Object3D): void {
  safeTraverse(obj, (child) => {
    if (!isMesh(child)) return;

    if (!child.userData) {
      child.userData = {};
    }

    // Only save if not already saved (prevents overwriting original with modified)
    if (typeof child.userData[LEGACY_USER_DATA_KEYS.origLayerMask] === 'undefined') {
      child.userData[LEGACY_USER_DATA_KEYS.origLayerMask] = child.layers.mask;
    }
  });
}

/**
 * Restore the original layer masks for an object and all its mesh children.
 * Also cleans up the userData keys.
 *
 * @param obj - The object to restore layer masks for
 */
export function restoreLayerMasks(obj: Object3D): void {
  safeTraverse(obj, (child) => {
    if (!child.layers) return;

    const origMask = child.userData?.[LEGACY_USER_DATA_KEYS.origLayerMask];
    if (typeof origMask === 'number') {
      child.layers.mask = origMask;
    }

    // Clean up the stored key
    if (child.userData) {
      delete child.userData[LEGACY_USER_DATA_KEYS.origLayerMask];
    }
  });
}

/**
 * Enable layer 0 (main pass) on an object and all its children.
 * This ensures objects remain visible in the main render pass
 * while also participating in selective bloom.
 *
 * @param obj - The object to enable layer 0 on
 */
export function enableMainPassLayer(obj: Object3D): void {
  safeTraverse(obj, (child) => {
    if (child.layers && typeof child.layers.enable === 'function') {
      child.layers.enable(0);
    }
  });
}

/**
 * Check if an object has saved layer mask data.
 *
 * @param obj - The object to check
 * @returns True if the object has saved layer mask data
 */
export function hasSavedLayerMask(obj: Object3D): boolean {
  return typeof obj.userData?.[LEGACY_USER_DATA_KEYS.origLayerMask] === 'number';
}

/**
 * Get the saved layer mask from an object's userData.
 *
 * @param obj - The object to get the saved mask from
 * @returns The saved mask, or undefined if not saved
 */
export function getSavedLayerMask(obj: Object3D): number | undefined {
  const mask = obj.userData?.[LEGACY_USER_DATA_KEYS.origLayerMask];
  return typeof mask === 'number' ? mask : undefined;
}
