/**
 * Bloom system configuration constants.
 *
 * Extracted from BloomProvider.tsx as part of DESIGN061 modular refactoring.
 */

import { POSTPROCESSING_CONFIG } from '../../config/renderer.js';
import type { BloomUserDataKeys } from './types.js';

/**
 * Starting layer index for bloom selections.
 * Three.js supports layers 0-31; we start at 11 to avoid conflicts with
 * commonly used layers (0=default, 1-10 often used for scene organization).
 */
export const LAYER_START = POSTPROCESSING_CONFIG.bloomLayerStart ?? 11;

/**
 * Maximum valid layer index in Three.js.
 * Layers are represented as a 32-bit bitmask, so valid range is [0, 31].
 */
export const LAYER_MAX = 31;

/**
 * Minimum valid layer index in Three.js.
 */
export const LAYER_MIN = 0;

/**
 * Default group name when no explicit group is specified.
 */
export const FALLBACK_GROUP = 'default';

/**
 * UserData keys used to store bloom-related state on Three.js objects.
 * Using a consistent prefix helps identify bloom system data during debugging.
 */
export const BLOOM_USER_DATA_KEYS: BloomUserDataKeys = {
  /** Key for storing the original layer mask before bloom registration. */
  origLayerMask: '__bloom_origLayerMask',
  /** Key for storing the original colorWrite values for all materials. */
  origColorWrite: '__bloom_origColorWrite',
  /** Key for materials that should always write to color buffer even when bloom is enabled. */
  forceColorWrite: '__bloom_forceColorWrite',
} as const;

/**
 * Legacy userData keys for backward compatibility.
 * These match the keys used in the original BloomProvider implementation.
 * @deprecated Use BLOOM_USER_DATA_KEYS for new code
 */
export const LEGACY_USER_DATA_KEYS = {
  origLayerMask: '__copilot_bloomOrigLayerMask',
  origColorWrite: '__copilot_bloomOrigColorWrite',
  forceColorWrite: '__copilot_forceColorWrite',
} as const;
