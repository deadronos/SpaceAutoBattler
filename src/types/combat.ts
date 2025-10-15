import type { Vector3 } from 'three';
import type { Team } from './gameplay.js';
import type { DamageType } from './gameplay.js';

export type ProjectileCategory = 'bullet' | 'missile' | 'torpedo' | 'beam';

export interface HomingParams {
  turnRate: number;
  lead?: boolean;
}

export interface BeamVisualConfig {
  ttl: number;
  length: number;
  width: number;
}

export interface BeamRuntimeState extends BeamVisualConfig {
  /** Maximum visual reach of the beam before it fades out. */
  maxLength: number;
  /** Optional local-space origin relative to the firing ship. */
  localOrigin?: Vector3;
  /** Optional local-space direction relative to the firing ship's forward. */
  localDirection?: Vector3;
  /** Optional identifier for the turret entity that spawned this beam. */
  sourceTurretId?: number;
  /** Optional index for embedded turrets on the firing ship. */
  sourceTurretIndex?: number;
}

export type { DamageType };

export interface DamageEffectiveness {
  [damageType: string]: {
    hull: number; // Effectiveness vs hull HP
    shield: number; // Effectiveness vs shield HP
    armor: number; // Effectiveness vs armor defense
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
  /** Canonical behaviour category for this projectile. */
  category: ProjectileCategory;
  /** Optional targeted entity id for homing logic. */
  targetId?: number;
  /** Homing parameters if projectile steers in-flight. */
  homing?: HomingParams;
  /** Minimum arming time before detonation (seconds). */
  armingTime?: number;
  /** Whether the projectile has passed its arming threshold. */
  armed?: boolean;
  /** Radius for area-of-effect detonation (world units). */
  aoeRadius?: number;
  /** Simulation time when the projectile spawned. */
  spawnTime: number;
  /** Optional beam visuals (for hitscan-style weapons). */
  beam?: BeamRuntimeState;
  /** Internal marker used to avoid repeated beam resolution. */
  hasAppliedBeamDamage?: boolean;
  /** Maximum effective range this projectile can hit (world units). */
  range?: number;
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
  /** Optional behaviour category override for spawned projectiles. */
  projectileCategory?: ProjectileCategory;
  /** Optional arc limits in radians relative to parent forward. */
  minYaw?: number;
  maxYaw?: number;
  minPitch?: number;
  maxPitch?: number;
  /** Optional targeting priority for turret AI. */
  priority?: 'any' | 'antiFighter' | 'antiCapital';
  /** Whether the turret is configured for point-defense. */
  pointDefense?: boolean;
  /** Range to scan for point-defense interception (defaults to range). */
  pointDefenseRange?: number;
}

/** Runtime turret state (derived from TurretSpec). Lives on the parent ship entity. */
export interface TurretState extends TurretSpec {
  /** Countdown timer until the turret can fire again. */
  cooldown: number;
  /** Current world-space aim direction for beam alignment and VFX. */
  aimDirection?: Vector3;
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
  /** Current world-space aim direction for beam alignment and VFX. */
  aimDirection?: Vector3;
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

/** Visual-only component for rendering beam weapons. No collision or damage logic. */
export interface BeamVisualComponent {
  /** Team that fired this beam (for coloring/effects). */
  team: Team;
  /** Time remaining before the visual expires (seconds). */
  ttl: number;
  /** Maximum TTL for fade calculations. */
  maxTtl: number;
  /** Width of the beam cylinder (world units). */
  width: number;
  /** Current visual length of the beam (world units). */
  length: number;
  /** Maximum length the beam can extend to. */
  maxLength: number;
  /** Optional material key for rendering. */
  bulletType?: string;
  /** Entity ID of the ship that fired this beam. */
  sourceId?: number;
  /** Optional turret entity ID if fired from a turret. */
  sourceTurretId?: number;
  /** Optional turret index if fired from an embedded turret. */
  sourceTurretIndex?: number;
  /** Simulation time when the beam was spawned. */
  spawnTime: number;
  /** Ship-local spawn offset captured at fire time for alignment. */
  localOrigin?: Vector3;
  /** Ship-local firing direction captured at fire time for alignment. */
  localDirection?: Vector3;
}
