/**
 * Layer allocation utilities for the bloom system.
 *
 * Three.js uses a 32-bit bitmask for layers (0-31). This module manages
 * allocation of layer indices to bloom groups and computation of layer masks.
 */

import type { Selection } from 'postprocessing';
import type { LayerAllocatorState } from './types.js';
import { LAYER_MIN, LAYER_MAX, LAYER_START } from './constants.js';

/**
 * Normalize a layer index value to a valid Three.js layer range [0, 31].
 *
 * @param value - Any value that might represent a layer index
 * @param fallback - Fallback value if input is not finite (defaults to LAYER_START)
 * @returns A valid layer index clamped to [0, 31]
 */
export function normalizeLayerIndex(value: unknown, fallback: number = LAYER_START): number {
  const n = Number(value);
  if (!Number.isFinite(n)) {
    // Ensure fallback is also valid
    const safeFallback = Math.max(LAYER_MIN, Math.min(Math.floor(fallback), LAYER_MAX));
    return safeFallback;
  }
  const i = Math.floor(n);
  return Math.max(LAYER_MIN, Math.min(i, LAYER_MAX));
}

/**
 * Allocate a layer index for a bloom group.
 *
 * If the group already has an allocated layer, returns it.
 * Otherwise, allocates the next available layer and stores the mapping.
 *
 * @param state - The allocator state to read/update
 * @param group - The group name to allocate a layer for
 * @returns The allocated layer index for the group
 */
export function allocateLayer(state: LayerAllocatorState, group: string): number {
  const existing = state.allocatedLayers.get(group);
  if (existing !== undefined) {
    return existing;
  }

  const layer = normalizeLayerIndex(state.nextLayer);
  state.allocatedLayers.set(group, layer);

  // Advance to next layer, capping at LAYER_MAX
  state.nextLayer = Math.min(layer + 1, LAYER_MAX);

  return layer;
}

/**
 * Create a fresh allocator state.
 *
 * @param startLayer - Initial layer index to start allocations from
 * @returns A new LayerAllocatorState
 */
export function createAllocatorState(startLayer: number = LAYER_START): LayerAllocatorState {
  return {
    nextLayer: normalizeLayerIndex(startLayer),
    allocatedLayers: new Map(),
  };
}

/**
 * Compute the union bitmask of all selection layers.
 *
 * @param selections - Map of group names to Selection objects
 * @returns A bitmask with bits set for each selection's layer
 */
export function computeLayerMask(selections: Map<string, Selection>): number {
  let mask = 0;
  for (const selection of selections.values()) {
    const layer = (selection as { layer?: unknown }).layer;
    if (
      typeof layer === 'number' &&
      Number.isFinite(layer) &&
      layer >= LAYER_MIN &&
      layer <= LAYER_MAX
    ) {
      mask |= 1 << layer;
    }
  }
  return mask;
}

/**
 * Check if a layer index is valid (within Three.js layer range).
 *
 * @param layer - The layer index to check
 * @returns True if the layer is a valid integer in [0, 31]
 */
export function isValidLayer(layer: unknown): layer is number {
  return (
    typeof layer === 'number' && Number.isInteger(layer) && layer >= LAYER_MIN && layer <= LAYER_MAX
  );
}
