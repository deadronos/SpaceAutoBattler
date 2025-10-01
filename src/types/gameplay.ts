import type { Quaternion, Vector3 } from 'three';

export type Team = 'blue' | 'red';

export type ShipHull = 'fighter' | 'corvette' | 'frigate' | 'destroyer' | 'carrier';

export type StatusEffectTag = 'jammed' | 'shield-down' | 'engine-disrupted' | 'hacked';

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
  /** Optional maximum lateral acceleration for strafe movement (units/s²). */
  maxLateralAcceleration?: number;
  /** Optional renderer smoothing preferences for this hull. */
  smoothing?: MotionSmoothingConfig;
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
}
