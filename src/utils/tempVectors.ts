import { Quaternion, Vector3 } from 'three';

/**
 * Centralized pool of module-scoped scratch Vector3 / Quaternion instances.
 * Import these instead of declaring ad-hoc `const TEMP_X = new Vector3()` at each module.
 *
 * NOTE: Callers must NOT retain references across call sites. These are shared
 * scratch buffers — the next call will overwrite them.
 */

/** Read-only forward direction matching the scene convention (Z-forward). */
export const FORWARD = Object.freeze(new Vector3(0, 0, 1));

/** Read-only fallback for degenerate normalize inputs. */
export const DEFAULT_FALLBACK = Object.freeze(new Vector3(0, 0, 1));

// --- General-purpose numbered slots ---

export const TEMP_VEC3_0 = new Vector3();
export const TEMP_VEC3_1 = new Vector3();
export const TEMP_VEC3_2 = new Vector3();
export const TEMP_VEC3_3 = new Vector3();
export const TEMP_VEC3_4 = new Vector3();
export const TEMP_VEC3_5 = new Vector3();

export const TEMP_QUAT_0 = new Quaternion();
export const TEMP_QUAT_1 = new Quaternion();

// --- Semantic aliases for common patterns ---

/** General-purpose scratch position. */
export const TEMP_POS = TEMP_VEC3_0;

/** General-purpose scratch direction. */
export const TEMP_DIR = TEMP_VEC3_1;

/** General-purpose scratch target position. */
export const TEMP_TARGET = TEMP_VEC3_2;

/** General-purpose scratch relative position. */
export const TEMP_REL_POS = TEMP_VEC3_3;

/** General-purpose scratch offset. */
export const TEMP_OFFSET = TEMP_VEC3_4;

/** General-purpose scratch right vector. */
export const TEMP_RIGHT = TEMP_VEC3_5;

/** General-purpose scratch quaternion. */
export const TEMP_QUAT = TEMP_QUAT_0;
