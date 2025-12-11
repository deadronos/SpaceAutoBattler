/**
 * Selection management utilities for the bloom system.
 *
 * Manages the lifecycle of postprocessing Selection objects,
 * including creation, object registration, and group management.
 */

import { Selection } from 'postprocessing';
import type { Object3D } from 'three';
import type { LayerAllocatorState } from './types.js';
import { allocateLayer } from './layerAllocator.js';

/**
 * Create a new Selection object with the specified layer.
 *
 * @param layer - The Three.js layer index for this selection
 * @param exclusive - Whether this selection is exclusive (removes objects from main pass)
 * @returns A new Selection configured with the given layer
 */
export function createSelection(layer: number, exclusive: boolean = false): Selection {
  const selection = new Selection();
  selection.layer = layer;
  selection.exclusive = exclusive;
  return selection;
}

/**
 * Add an object to a selection if not already present.
 *
 * @param selection - The Selection to add the object to
 * @param obj - The Object3D to add
 * @returns True if the object was added, false if it was already present
 */
export function addObjectToSelection(selection: Selection, obj: Object3D): boolean {
  if (selection.has(obj)) {
    return false;
  }
  selection.add(obj);
  return true;
}

/**
 * Remove an object from a selection.
 *
 * @param selection - The Selection to remove the object from
 * @param obj - The Object3D to remove
 * @returns True if the object was removed, false if it wasn't present
 */
export function removeObjectFromSelection(selection: Selection, obj: Object3D): boolean {
  if (!selection.has(obj)) {
    return false;
  }
  selection.delete(obj);
  return true;
}

/**
 * Ensure a selection exists for a given group, creating one if necessary.
 *
 * @param selections - Map of group names to Selection objects
 * @param group - The group name to ensure a selection for
 * @param allocator - The layer allocator state for assigning new layers
 * @returns The Selection for the group (existing or newly created)
 */
export function ensureSelectionForGroup(
  selections: Map<string, Selection>,
  group: string,
  allocator: LayerAllocatorState,
): Selection {
  let selection = selections.get(group);
  if (!selection) {
    const layer = allocateLayer(allocator, group);
    selection = createSelection(layer, false);
    selections.set(group, selection);
  }
  return selection;
}

/**
 * Get the layer index from a Selection object.
 *
 * @param selection - The Selection to get the layer from
 * @returns The layer index, or undefined if not set
 */
export function getSelectionLayer(selection: Selection): number | undefined {
  const layer = (selection as { layer?: unknown }).layer;
  if (typeof layer === 'number' && Number.isFinite(layer)) {
    return layer;
  }
  return undefined;
}

/**
 * Check if a selection contains an object.
 *
 * @param selection - The Selection to check
 * @param obj - The Object3D to look for
 * @returns True if the selection contains the object
 */
export function selectionHasObject(selection: Selection, obj: Object3D): boolean {
  return selection.has(obj);
}

/**
 * Clear all objects from a selection.
 *
 * @param selection - The Selection to clear
 */
export function clearSelection(selection: Selection): void {
  selection.clear();
}
