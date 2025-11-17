import { Quaternion, Vector3 } from 'three';

export const TEMP_FORWARD = new Vector3();
export const TEMP_TARGET_DIR = new Vector3();
export const TEMP_VELOCITY_CHANGE = new Vector3();
export const TEMP_ROTATION = new Quaternion();
export const TEMP_RIGHT = new Vector3();
export const TEMP_AXIS = new Vector3();
export const TEMP_DESIRED_AV = new Vector3();
export const TEMP_AV_DELTA = new Vector3();
export const TEMP_UP = new Vector3(0, 1, 0);
export const TEMP_HEADING = new Vector3();
export const TEMP_NEXT_POS = new Vector3();

export const DEFAULT_TURN_KP = 4.0;
export const DEFAULT_TURN_KD = 0.6;
export const DEFAULT_SETTLE_RATE = 0.2;
export const DEFAULT_SETTLE_TOLERANCE_DEG = 5;
export const ANGULAR_SPEED_EPSILON = 1e-5;
