export const MOTION_IDLE_THRESHOLDS = {
  /** Absolute thrust value below which a command is treated as idle. */
  thrustEpsilon: 1e-3,
  /** Absolute strafe value below which lateral input is ignored for idle detection. */
  strafeEpsilon: 1e-3,
  /** Cosine of the maximum heading angle difference to consider the ship aligned. */
  headingAlignmentDot: 0.999,
  /** Linear speed below which a ship is considered stationary for idle skips. */
  linearSpeedEpsilon: 1e-3,
  /** Angular speed below which a ship is considered stationary for idle skips. */
  angularSpeedEpsilon: 1e-3,
} as const;

export type MotionIdleThresholds = typeof MOTION_IDLE_THRESHOLDS;
