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

// --- Game/systems cluster slots (#663) ---
// Each former module-local scratch temp gets its own distinct slot so two
// modules (or two call chains) can never alias the same buffer.

// motion/sharedTemps.ts
export const TEMP_MOTION_FORWARD = new Vector3();
export const TEMP_MOTION_TARGET_DIR = new Vector3();
export const TEMP_MOTION_VELOCITY_CHANGE = new Vector3();
export const TEMP_MOTION_ROTATION = new Quaternion();
export const TEMP_MOTION_RIGHT = new Vector3();
export const TEMP_MOTION_AXIS = new Vector3();
export const TEMP_MOTION_DESIRED_AV = new Vector3();
export const TEMP_MOTION_AV_DELTA = new Vector3();
export const TEMP_MOTION_UP = new Vector3(0, 1, 0);
export const TEMP_MOTION_HEADING = new Vector3();
export const TEMP_MOTION_NEXT_POS = new Vector3();

// shipControl/sharedTemps.ts
export const TEMP_SHIPCONTROL_DIR = new Vector3();
export const TEMP_SHIPCONTROL_POS = new Vector3();
export const TEMP_SHIPCONTROL_REL_POS = new Vector3();
export const TEMP_SHIPCONTROL_QUAT = new Quaternion();

// projectiles/sharedTemps.ts
export const TEMP_PROJECTILES_POS = new Vector3();
export const TEMP_PROJECTILES_TARGET = new Vector3();

// decision/intent-utils.ts
export const TEMP_DECISION_DIR = new Vector3();
export const TEMP_DECISION_POS = new Vector3();
export const TEMP_DECISION_REL_POS = new Vector3();
export const TEMP_DECISION_TARGET_VEL = new Vector3();
export const TEMP_DECISION_SHIP_VEL = new Vector3();
export const TEMP_DECISION_REL_VEL = new Vector3();

// sensors.ts
export const TEMP_SENSORS_FORWARD = new Vector3();
export const TEMP_SENSORS_VECTOR = new Vector3();
export const TEMP_SENSORS_DIRECTION = new Vector3();

// carriers.ts
export const TEMP_CARRIERS_FORWARD = new Vector3();
export const TEMP_CARRIERS_RIGHT = new Vector3();
export const TEMP_CARRIERS_UP = new Vector3();
export const TEMP_CARRIERS_OFFSET = new Vector3();
export const TEMP_CARRIERS_POS = new Vector3();

// projectileDamage.ts
export const TEMP_PROJECTILE_DAMAGE_RIPPLE_DIR = new Vector3();

// --- Remaining module-local scratch temps (#663, Task 2) ---
// Each former module-local scratch temp gets its own distinct slot so two
// modules (or two call chains) can never alias the same buffer.

// utils/projectileInfo.ts
export const TEMP_PROJECTILE_INFO_HIT_VECTOR = new Vector3();

// components/debris/DebrisInstancedManager.ts
export const TEMP_DEBRIS_QUAT = new Quaternion();
export const TEMP_DEBRIS_VEC = new Vector3();

// components/layers/ProjectilesInstancedLayer.tsx
export const TEMP_PROJECTILES_LAYER_SCALE = new Vector3();
export const TEMP_PROJECTILES_LAYER_POSITION = new Vector3();

// components/layers/MuzzleFlashInstancedLayer.tsx
export const TEMP_MUZZLE_SCALE = new Vector3();
export const TEMP_MUZZLE_POS = new Vector3();
export const TEMP_MUZZLE_ROT = new Quaternion();

// components/HudOverlayCollector.tsx
export const TEMP_HUD_POSITION = new Vector3();
