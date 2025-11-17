import type { Vector3 } from 'three';
import type { Collider, RigidBody } from './core.js';
import type {
  Team,
  ShipHull,
  StatusEffectTag,
  TransformComponent,
  MotionStats,
  SensorProfile,
} from './gameplay.js';
import type { DamageType } from './gameplay.js';
import type {
  SubsystemType,
  Subsystem,
  ShipLevelBonuses,
  Captain,
  ProgressionEvent,
} from './progression.js';
import type { TurretState, MuzzleFlash } from './combat.js';

export interface CarrierLaunchSlot {
  /** Forward offset in world units relative to the carrier's origin. */
  forward: number;
  /** Lateral offset in world units relative to the carrier's right vector. */
  lateral: number;
  /** Optional vertical offset in world units relative to the carrier's up vector. */
  vertical?: number;
}

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

export interface ShipComponent {
  team: Team;
  hull: ShipHull;
  hp: number;
  maxHp: number;
  /** Current shield hit points. Visual opacity scales with this value. */
  shield: number;
  /** Max shield hit points. */
  maxShield: number;
  /** Shield regeneration rate in hit points per second (optional). */
  shieldRegen?: number;
  cooldown: number;
  fireRate: number;
  damage: number;
  projectileSpeed: number;
  range: number;
  speed: number;
  /** Key for the projectile material/type this ship fires (e.g. 'bullet:laser') */
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

  // Ship Progression System
  /** Experience points accumulated by this ship */
  xp: number;
  /** Current level of this ship */
  level: number;
  /** Experience points needed to reach next level */
  xpToNext: number;
  /** Damage type this ship deals (overrides bulletType for effectiveness calculations) */
  damageType: DamageType;
  /** Cumulative level bonus multipliers applied to capped stats */
  levelBonuses: ShipLevelBonuses;

  // Captain System (for large ships)
  /** Captain assigned to this ship (destroyers and carriers only) */
  captain?: Captain;

  // Subsystem Health
  /** Health and status of ship subsystems */
  subsystems: Record<SubsystemType, Subsystem>;

  // Defense Categories (for damage type effectiveness)
  /** Armor value for damage type calculations */
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

export interface GameEntity extends TransformComponent {
  id: number;
  rigidBody: RigidBody;
  collider: Collider;
  ship?: ShipComponent;
  projectile?: import('./combat.js').ProjectileComponent;
  turret?: import('./combat.js').TurretComponent;
  carrier?: CarrierComponent;
  ai?: import('./ai.js').AIState;
  /** Unit direction vector used for projectile integration. */
  direction?: Vector3;
  /** Identifier of the model to render for this entity. */
  model?: ShipHull;
  /** Recent shield ripple events, renderer-only consumption. Kept on GameState for determinism. */
  shieldRipples?: ShieldRipple[];
  /** Optional array of turrets mounted on this ship (if entity has a ShipComponent). */
  turrets?: TurretState[];
  /** Recent muzzle flash events; rendered client-side and naturally fade based on state.time. */
  muzzleFlashes?: MuzzleFlash[];
}

export type ShipEntity = GameEntity & { ship: ShipComponent };
export type ProjectileEntity = GameEntity & {
  projectile: import('./combat.js').ProjectileComponent;
  direction: Vector3;
};
export type TurretEntity = GameEntity & { turret: import('./combat.js').TurretComponent };

export interface GameQueries {
  ships: import('./core.js').Archetype<GameEntity, ['ship']>;
  shipsWithCommands?: import('./core.js').Archetype<GameEntity, ['ship', 'ai']>;
  projectiles: import('./core.js').Archetype<GameEntity, ['projectile']>;
  turrets: import('./core.js').Archetype<GameEntity, ['turret']>;
}

export type { ProgressionEvent };
