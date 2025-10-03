import type { Vector3 } from 'three';
import type { Team } from './gameplay.js';
import type { DamageType } from './gameplay.js';

export type { DamageType };

export interface DamageEffectiveness {
  [damageType: string]: {
    hull: number;         // Effectiveness vs hull HP
    shield: number;       // Effectiveness vs shield HP
    armor: number;        // Effectiveness vs armor defense
  };
}

export interface ProjectileComponent {
  team: Team;
  damage: number;
  ttl: number;
  maxTtl: number;
  speed: number;
  /** Material key or type identifier for rendering this projectile (optional) */
  bulletType?: string;
  /** Damage type for effectiveness calculations */
  damageType: DamageType;
  /** Entity ID of the ship that fired this projectile */
  sourceId?: number;
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
  /** Optional arc limits in radians relative to parent forward. */
  minYaw?: number;
  maxYaw?: number;
  minPitch?: number;
  maxPitch?: number;
  /** Optional targeting priority for turret AI. */
  priority?: 'any' | 'antiFighter' | 'antiCapital';
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
  /** Current yaw (around Y) and pitch (around X), radians, relative to parent ship forward. */
  yaw?: number;
  pitch?: number;
  /** Arc limits in radians (relative to parent forward). Defaults to wide arcs if not set. */
  minYaw?: number;
  maxYaw?: number;
  minPitch?: number;
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
