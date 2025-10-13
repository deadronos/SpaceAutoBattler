import type { Quaternion, Vector3 } from 'three';

export type Team = 'blue' | 'red';

export type ShipHull = 'fighter' | 'corvette' | 'frigate' | 'destroyer' | 'carrier';

export type StatusEffectTag = 'jammed' | 'shield-down' | 'engine-disrupted' | 'hacked';

export interface SensorProfile {
  /** Effective range in world units for acquiring new contacts. */
  detectionRange: number;
  /** Maximum range in world units to maintain an existing contact before it fades. */
  trackingRange: number;
  /** Sensor forward cone angle in radians. */
  coneAngle: number;
  /** Falloff factor (0..1) applied when tracking beyond detection range. */
  falloff: number;
}

export interface TransformComponent {
  transform: {
    position: Vector3;
    rotation: Quaternion;
    scale: number;
  };
}

export interface ShipBlueprint {
  hull: ShipHull;
  team: Team;
  position: Vector3;
  heading: number;
  parentCarrierId?: number;
}

/** Motion characteristics for physics-based ship movement. */
export interface MotionStats {
  /** Ship mass for inertia calculations (arbitrary units). */
  mass: number;
  /** Maximum linear speed in units per second. */
  maxSpeed: number;
  /** Maximum reverse speed in units per second (defaults to 0 = no reverse). */
  maxReverseSpeed?: number;
  /** Maximum linear acceleration in units per second squared. */
  linearAcceleration: number;
  /** Linear velocity damping factor (0 = no damping, higher = more damping). */
  linearDamping: number;
  /** Maximum angular turn rate in radians per second. */
  maxTurnRate: number;
  /** Maximum angular acceleration in radians per second squared. */
  angularAcceleration: number;
  /** Angular velocity damping factor (0 = no damping, higher = more damping). */
  angularDamping: number;
  /** Optional proportional gain for yaw control (default: 4.0). */
  turnKp?: number;
  /** Optional derivative gain for yaw control based on current angular velocity (default: 0.6). */
  turnKd?: number;
  /** Maximum angular velocity the controller should allow once aligned (rad/s). */
  angularSettlingRate?: number;
  /** Heading error tolerance that activates settling logic (degrees). */
  angularSettleToleranceDeg?: number;
  /** Optional maximum lateral acceleration for strafe movement (units/s²). */
  maxLateralAcceleration?: number;
  /** Optional renderer smoothing preferences for this hull. */
  smoothing?: MotionSmoothingConfig;
  /** Optional new visual config using time-constant semantics (preferred). */
  visual?: MotionVisualConfig;
  /** Visual banking sensitivity (degrees per radian/second yaw by default). */
  visualBankFactor?: number;
  /** Maximum visual banking angle in degrees. */
  maxBankDeg?: number;
}

/** Renderer smoothing configuration applied on top of physics state. */
export interface MotionSmoothingConfig {
  /** Linear interpolation factor applied each render frame (0..1). */
  positionLerp?: number;
  /** Spherical linear interpolation factor applied each render frame (0..1). */
  rotationSlerp?: number;
  /** Low-pass filter factor for visual banking (0..1). */
  bankLerp?: number;
  /** Threshold distance that resets interpolation to avoid trails. */
  teleportDistance?: number;
}

/** Renderer-level visual smoothing and bob/sway configuration (time-constant based). */
export interface MotionVisualConfig {
  enabled?: boolean; // master enable for visual smoothing for this hull
  /** Position smoothing time-constant (seconds^-1). Higher = faster convergence. */
  position?: { k?: number };
  /** Rotation smoothing time-constant (seconds^-1). */
  rotation?: { k?: number };
  /** Banking smoothing/limits. */
  bank?: { k?: number; maxDeg?: number; useCriticallyDamped?: boolean };
  /** Distance threshold that resets interpolation to avoid trails. */
  teleportDistance?: number;
  /** Optional bob settings — minimal safe defaults; amplitude is hull/unit aware. */
  bob?: {
    enabled?: boolean;
    baseAmp?: number;
    freq?: number;
    speedScale?: number;
    maxAmp?: number;
  };
  /** Whether to enable Rapier CCD for this hull's collider (opt-in). */
  enableCcd?: boolean;
}

export type DamageType = 'kinetic' | 'plasma' | 'ion' | 'explosive';

export interface ShipStats {
  hull: ShipHull;
  maxHp: number;
  /** Suggested shield capacity for ships of this hull. */
  maxShield?: number;
  /** Suggested shield regeneration (hp per second) for this hull. Optional. */
  shieldRegen?: number;
  damage: number;
  fireRate: number;
  projectileSpeed: number;
  range: number;
  speed: number;
  scale: number;
  /** Preferred bullet/material key for this hull (e.g. 'bullet:laser') */
  bulletType?: string;
  /** Default damage type for this hull */
  damageType: DamageType;
  /** Base armor value for this hull */
  armor: number;
  /** Optional default turret loadout for this hull. */
  turrets?: import('./combat.js').TurretSpec[];
  /** Motion characteristics for physics-based movement. */
  motion: MotionStats;
  /** Baseline sensor profile used for detection and fog-of-war simulation. */
  sensor: SensorProfile;
  /** Intrinsic stealth modifier (0..1, higher = harder to detect). */
  stealth?: number;
  /** Relative detection signature (1 = baseline, >1 easier to detect). */
  sensorSignature?: number;
}
