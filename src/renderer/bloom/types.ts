/**
 * Bloom system type definitions.
 *
 * Extracted from BloomProvider.tsx as part of DESIGN061 modular refactoring.
 */

import type { Camera, Object3D, Material } from 'three';
import type { Selection } from 'postprocessing';

/**
 * Options for registering an object with the bloom system.
 */
export interface BloomRegistrationOptions {
  /** Optional group name that maps to renderer bloom configuration. */
  group?: string;
  /** Whether the object should participate in bloom. Defaults to true. */
  active?: boolean;
}

/**
 * Context value provided by BloomProvider to child components.
 */
export interface BloomContextValue {
  /** Whether bloom postprocessing is currently enabled. */
  enabled: boolean;
  /** Default group used when components omit explicit configuration. */
  defaultGroup: string;
  /** Stable selections per bloom group. */
  selections: Map<string, Selection>;
  /** Register an object for selective bloom rendering. */
  register: (obj: Object3D | null | undefined, options?: BloomRegistrationOptions) => void;
  /** Unregister an object from selective bloom rendering. */
  unregister: (obj: Object3D | null | undefined) => void;
  /**
   * Compute the union bitmask of all selection layers.
   * Useful for telling a Camera which layers must be visible to render
   * selective-bloom objects (e.g. star layer, muzzle flashes, etc.).
   */
  getSelectionLayerMask: () => number;
  /**
   * Enable all selection layers on a given camera and return the
   * camera's previous layers.mask so callers can restore it.
   */
  enableCameraLayers: (camera: Camera) => number;
}

/**
 * State container for layer index allocation.
 * Used by layerAllocator.ts to track allocated layers per group.
 */
export interface LayerAllocatorState {
  /** Next available layer index to allocate. */
  nextLayer: number;
  /** Map of group names to their allocated layer indices. */
  allocatedLayers: Map<string, number>;
}

/**
 * State container for material colorWrite preservation.
 * Used by materialManager.ts to track original colorWrite values.
 */
export interface MaterialColorWriteState {
  /** Map of materials to their original colorWrite values. */
  originals: Map<Material, boolean | undefined>;
}

/**
 * UserData keys for storing bloom-related state on Three.js objects.
 * These are stored on mesh.userData during registration and cleaned up on unregister.
 */
export interface BloomUserDataKeys {
  /** Key for storing original layer mask value. */
  readonly origLayerMask: string;
  /** Key for storing original colorWrite values array. */
  readonly origColorWrite: string;
  /** Key for force-write flag that prevents colorWrite modification. */
  readonly forceColorWrite: string;
}
