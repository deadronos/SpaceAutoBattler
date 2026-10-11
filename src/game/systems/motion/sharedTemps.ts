// Re-exported from the central scratch pool (src/utils/tempVectors.ts) under the
// historical public names so sibling relative imports keep working.
export {
  TEMP_MOTION_FORWARD as TEMP_FORWARD,
  TEMP_MOTION_TARGET_DIR as TEMP_TARGET_DIR,
  TEMP_MOTION_VELOCITY_CHANGE as TEMP_VELOCITY_CHANGE,
  TEMP_MOTION_ROTATION as TEMP_ROTATION,
  TEMP_MOTION_RIGHT as TEMP_RIGHT,
  TEMP_MOTION_AXIS as TEMP_AXIS,
  TEMP_MOTION_DESIRED_AV as TEMP_DESIRED_AV,
  TEMP_MOTION_AV_DELTA as TEMP_AV_DELTA,
  TEMP_MOTION_UP as TEMP_UP,
  TEMP_MOTION_HEADING as TEMP_HEADING,
  TEMP_MOTION_NEXT_POS as TEMP_NEXT_POS,
} from '../../../utils/tempVectors.js';

export const DEFAULT_TURN_KP = 4.0;
export const DEFAULT_TURN_KD = 0.6;
export const DEFAULT_SETTLE_RATE = 0.2;
export const DEFAULT_SETTLE_TOLERANCE_DEG = 5;
export const ANGULAR_SPEED_EPSILON = 1e-5;
