import type { Vector3 } from 'three';
import type { Team } from './gameplay.js';
import type { DamageType } from './gameplay.js';
import type { ResolvedProjectileInfo } from '../utils/projectileInfo.js';

export type { DamageType };

/**
 * Effectiveness multipliers for a damage type against different defenses.
 */
export interface DamageEffectiveness {
  /** Map of damage type keys to effectiveness stats. */
  [damageType: string]: {
    /** Effectiveness multiplier against hull HP (1.0 = standard). */
    hull: number;
    /** Effectiveness multiplier against shield HP (1.0 = standard). */
    shield: number;
    /** Effectiveness multiplier against armor defense (1.0 = standard). */
    armor: number;
  };
}

/**
 * Categories of projectiles affecting their simulation behavior.
 */
export type ProjectileCategory = 'bullet' | 'missile' | 'torpedo' | 'beam';

/**
 * Configuration for projectile homing capabilities.
 */
export interface ProjectileHomingConfig {
  /** Maximum turn rate in radians per second. */
  turnRate: number;
  /** Whether the projectile should attempt to lead the target (predict position). */
  lead?: boolean;
}

/**
 * Runtime state for beam weapons.
 */
export interface ProjectileBeamRuntime {
  /** Time to live in seconds. */
  ttl: number;
  /** Maximum length of the beam in world units. */
  maxLength: number;
  /** Visual width of the beam. */
  width?: number;
  /** Point of impact in world coordinates. */
  hitPoint?: Vector3;
  /** Whether the damage/effect has been applied this tick. */
  applied?: boolean;
}

/**
 * ECS component representing a projectile.
 */
export interface ProjectileComponent {
  /** The team that fired this projectile. */
  team: Team;
  /** Damage dealt on impact. */
  damage: number;
  /** Time to live in seconds. */
  ttl: number;
  /** Initial time to live in seconds. */
  maxTtl: number;
  /** Speed in world units per second. */
  speed: number;
  /** Material key or type identifier for rendering this projectile (optional). */
  bulletType?: string;
  /** Precomputed render key resolved at spawn to avoid per-frame lookup. */
  renderKey?: string;
  /** Pre-resolved projectile info shared across render path to avoid repeated resolution. */
  renderInfo?: ResolvedProjectileInfo;
  /** Damage type for effectiveness calculations. */
  damageType: DamageType;
  /** Entity ID of the ship that fired this projectile. */
  sourceId?: number;
  /** Canonical simulation category for projectile behaviours. Defaults to 'bullet'. */
  category?: ProjectileCategory;
  /** Optional entity id this projectile is attempting to home toward. */
  targetId?: number;
  /** Homing behaviour parameters if projectile supports steering. */
  homing?: ProjectileHomingConfig;
  /** Minimum arming delay before projectile can detonate or deal damage. */
  armingTime?: number;
  /** Timestamp (GameState.time) when projectile spawned. */
  spawnTime?: number;
  /** Explosion radius in world units for AoE payloads. */
  aoeRadius?: number;
  /** Optional runtime beam data for hitscan projectiles. */
  beam?: ProjectileBeamRuntime;
}

/** Static configuration for a turret mounted on a ship. All values are in ship-local space. */
export interface TurretSpec {
  /** Local-space offset from the ship origin where this turret is mounted. */
  offset: Vector3;
  /** Damage per projectile. */
  damage: number;
  /** Seconds between shots (cooldown). */
  fireRate: number;
  /** Projectile speed units per second. */
  projectileSpeed: number;
  /** Effective range of this turret. */
  range: number;
  /** Optional renderer key for projectile visuals. */
  bulletType?: string;
  /** Optional lower arc limit in radians relative to parent forward. */
  minYaw?: number;
  /** Optional upper arc limit in radians relative to parent forward. */
  maxYaw?: number;
  /** Optional lower pitch limit in radians relative to parent forward. */
  minPitch?: number;
  /** Optional upper pitch limit in radians relative to parent forward. */
  maxPitch?: number;
  /** Optional targeting priority for turret AI. */
  priority?: 'any' | 'antiFighter' | 'antiCapital';
  /** Optional canonical projectile category override for behaviour hints. */
  projectileCategory?: ProjectileCategory;
}

/** Runtime turret state (derived from TurretSpec). Lives on the parent ship entity. */
export interface TurretState extends TurretSpec {
  /** Countdown timer until the turret can fire again. */
  cooldown: number;
}

/** ECS component for a turret entity, referencing its parent ship. */
export interface TurretComponent extends TurretSpec {
  /** The parent ship this turret is mounted on. */
  parent: import('./ship.js').ShipEntity;
  /** Runtime cooldown timer. */
  cooldown: number;
  /** Optional stable index on the parent for ordering. */
  index?: number;
  /** Current yaw (around Y) relative to parent ship forward in radians. */
  yaw?: number;
  /** Current pitch (around X) relative to parent ship forward in radians. */
  pitch?: number;
  /** Lower yaw limit in radians (relative to parent forward). Defaults to wide arcs if not set. */
  minYaw?: number;
  /** Upper yaw limit in radians (relative to parent forward). Defaults to wide arcs if not set. */
  maxYaw?: number;
  /** Lower pitch limit in radians. */
  minPitch?: number;
  /** Upper pitch limit in radians. */
  maxPitch?: number;
  /** Targeting priority for turret AI. */
  priority?: 'any' | 'antiFighter' | 'antiCapital';
}

/** Parameters for a short-lived muzzle flash event emitted when a weapon fires. */
export interface MuzzleFlash {
  /** Ship-local position where the flash should be rendered. */
  local: Vector3;
  /** Time when the flash started (GameState.time). */
  t0: number;
  /** Visual strength (0..1). */
  amp: number;
  /** Optional bullet type for tinting the flash. */
  bulletType?: string;
}
