import type { Vector3 } from 'three';
import type { Collider, RigidBody } from './core.js';
import type {
  Team,
  ShipHull,
  StatusEffectTag,
  TransformComponent,
  MotionStats,
  SensorProfile,
  VisualDetailLevel,
} from './gameplay.js';
import type { DamageType } from './gameplay.js';
import type {
  SubsystemType,
  Subsystem,
  ShipLevelBonuses,
  Captain,
  ProgressionEvent,
} from './progression.js';
import type { MuzzleFlash } from './combat.js';

/**
 * Definition of a launch slot for a carrier.
 */
export interface CarrierLaunchSlot {
  /** Forward offset in world units relative to the carrier's origin. */
  forward: number;
  /** Lateral offset in world units relative to the carrier's right vector. */
  lateral: number;
  /** Optional vertical offset in world units relative to the carrier's up vector. */
  vertical?: number;
}

/**
 * Configuration for carrier launch behavior.
 */
export interface CarrierLaunchConfig {
  /** Maximum number of alive fighters this carrier may field simultaneously. */
  maxActive: number;
  /** Cooldown in seconds between launch attempts. */
  cooldownSeconds: number;
  /** Number of fighters released per launch cycle (respecting the active cap). */
  batchSize: number;
  /** Launch pattern offsets relative to the carrier. */
  formation: readonly CarrierLaunchSlot[];
  /** Optional lateral jitter radius applied when spawning fighters. */
  jitterRadius?: number;
}

/**
 * ECS component representing a carrier's hangar and launch state.
 */
export interface CarrierComponent {
  /** Countdown timer before the carrier may launch another batch. */
  launchCooldownRemaining: number;
  /** List of fighter entity ids that are currently alive and tracked by the carrier. */
  activeFighterIds: number[];
  /** Cursor used to rotate through launch formation slots deterministically. */
  launchIndex: number;
  /** Launch behaviour configuration, usually sourced from CARRIER_LAUNCH_CONFIG. */
  config: CarrierLaunchConfig;
}

/**
 * ECS component representing a ship's state and statistics.
 */
export interface ShipComponent {
  /** The team the ship belongs to. */
  team: Team;
  /** The type of hull the ship has. */
  hull: ShipHull;
  /** Current hit points. */
  hp: number;
  /** Maximum hit points. */
  maxHp: number;
  /** Current shield hit points. Visual opacity scales with this value. */
  shield: number;
  /** Max shield hit points. */
  maxShield: number;
  /** Shield regeneration rate in hit points per second (optional). */
  shieldRegen?: number;
  /** Current weapon cooldown timer. */
  cooldown: number;
  /** Seconds between shots (fire rate). */
  fireRate: number;
  /** Damage per projectile fired by the ship's main guns. */
  damage: number;
  /** Speed of projectiles fired by the ship's main guns. */
  projectileSpeed: number;
  /** Maximum range of the ship's weapons. */
  range: number;
  /** Maximum movement speed. */
  speed: number;
  /** Key for the projectile material/type this ship fires (e.g. 'bullet:laser'). */
  bulletType?: string;
  /** Optional identifier if this ship was launched from a parent carrier. */
  parentCarrierId?: number;
  /** Current linear velocity in world space (units/s). */
  velocity: Vector3;
  /** Current angular velocity vector in radians per second (axis-angle form). */
  angularVelocity: Vector3;
  /** Most recent lateral acceleration applied in units per second squared. */
  lateralAcceleration: number;
  /** Motion characteristics for physics-based movement. */
  motion: MotionStats;
  /** Optional status effects applied to this ship for HUD overlays. */
  effects?: StatusEffectTag[];

  /** Sensor performance characteristics for fog-of-war resolution. */
  sensor: SensorProfile;
  /** Intrinsic stealth modifier (0..1, higher = harder to detect). */
  stealth?: number;
  /** Relative detection signature (1 = baseline, >1 easier to detect). */
  sensorSignature?: number;
  /** Optional renderer hint used to gate visual effects (high/medium/low). */
  visualDetailLevel?: VisualDetailLevel;

  // Ship Progression System
  /** Experience points accumulated by this ship. */
  xp: number;
  /** Current level of this ship. */
  level: number;
  /** Experience points needed to reach next level. */
  xpToNext: number;
  /** Damage type this ship deals (overrides bulletType for effectiveness calculations). */
  damageType: DamageType;
  /** Cumulative level bonus multipliers applied to capped stats. */
  levelBonuses: ShipLevelBonuses;

  // Captain System (for large ships)
  /** Captain assigned to this ship (destroyers and carriers only). */
  captain?: Captain;

  // Subsystem Health
  /** Health and status of ship subsystems. */
  subsystems: Record<SubsystemType, Subsystem>;

  // Defense Categories (for damage type effectiveness)
  /** Armor value for damage type calculations. */
  armor: number;
}

/** Parameters for a shield ripple kick emitted on impact. */
export interface ShieldRipple {
  /** Unit vector direction on the sphere surface in world space at impact moment. */
  dir: Vector3;
  /** Time when the ripple started (GameState.time). */
  t0: number;
  /** Visual strength (0..1). */
  amp: number;
}

/**
 * Union type representing a generic entity in the game world.
 * Contains optional components depending on what the entity is (ship, projectile, etc.).
 */
export interface GameEntity extends TransformComponent {
  /** Unique entity identifier. */
  id: number;
  /** Rapier3D rigid body component. */
  rigidBody: RigidBody;
  /** Rapier3D collider component. */
  collider: Collider;
  /** Optional ship component if this entity is a ship. */
  ship?: ShipComponent;
  /** Optional projectile component if this entity is a projectile. */
  projectile?: import('./combat.js').ProjectileComponent;
  /** Optional turret component if this entity is a turret. */
  turret?: import('./combat.js').TurretComponent;
  /** Optional carrier component if this entity is a carrier. */
  carrier?: CarrierComponent;
  /** Optional AI state component. */
  ai?: import('./ai.js').AIState;
  /** Unit direction vector used for projectile integration. */
  direction?: Vector3;
  /** Identifier of the model to render for this entity. */
  model?: ShipHull;
  /** Recent shield ripple events, renderer-only consumption. Kept on GameState for determinism. */
  shieldRipples?: ShieldRipple[];
  /** Optional array of turrets mounted on this ship (if entity has a ShipComponent). */
  muzzleFlashes?: MuzzleFlash[];
}

/** Type alias for an entity known to have a ship component. */
export type ShipEntity = GameEntity & { ship: ShipComponent };

/** Type alias for an entity known to have a projectile component. */
export type ProjectileEntity = GameEntity & {
  projectile: import('./combat.js').ProjectileComponent;
  direction: Vector3;
};

/** Type alias for an entity known to have a turret component. */
export type TurretEntity = GameEntity & { turret: import('./combat.js').TurretComponent };

/**
 * Miniplex queries used to access entities by their components.
 */
export interface GameQueries {
  /** Query for all ships. */
  ships: import('./core.js').Archetype<GameEntity, ['ship']>;
  /** Query for all ships that have AI commands. */
  shipsWithCommands?: import('./core.js').Archetype<GameEntity, ['ship', 'ai']>;
  /** Query for all projectiles. */
  projectiles: import('./core.js').Archetype<GameEntity, ['projectile']>;
  /** Query for all turrets. */
  turrets: import('./core.js').Archetype<GameEntity, ['turret']>;
}

export type { ProgressionEvent };
