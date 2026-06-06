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
export const TEMP_VEC3_6 = new Vector3();
export const TEMP_VEC3_7 = new Vector3();
export const TEMP_VEC3_8 = new Vector3();
export const TEMP_VEC3_9 = new Vector3();
export const TEMP_VEC3_10 = new Vector3();
export const TEMP_VEC3_11 = new Vector3();
export const TEMP_VEC3_12 = new Vector3();
export const TEMP_VEC3_13 = new Vector3();
export const TEMP_VEC3_14 = new Vector3();

export const TEMP_QUAT_0 = new Quaternion();
export const TEMP_QUAT_1 = new Quaternion();

// --- Semantic aliases for common patterns ---

export const TEMP_POS = TEMP_VEC3_0;
export const TEMP_DIR = TEMP_VEC3_1;
export const TEMP_TARGET = TEMP_VEC3_2;
export const TEMP_REL_POS = TEMP_VEC3_3;
export const TEMP_OFFSET = TEMP_VEC3_4;
export const TEMP_RIGHT = TEMP_VEC3_5;

export const TEMP_QUAT = TEMP_QUAT_0;

// --- Steering aliases ---

export const TEMP_LEAD = TEMP_VEC3_6;
export const TEMP_SEEK = TEMP_VEC3_7;
export const TEMP_INTERCEPT = TEMP_VEC3_8;
export const TEMP_INTERCEPT_TARGET = TEMP_VEC3_9;

// --- Turret / aiming aliases ---

export const TEMP_TURRET_DIR = TEMP_VEC3_10;
export const TEMP_LOCAL_DIR = TEMP_VEC3_11;
export const TEMP_TARGET_VEL = TEMP_VEC3_12;
export const TEMP_SHIP_VEL = TEMP_VEC3_13;
export const TEMP_REL_VEL = TEMP_VEC3_14;
