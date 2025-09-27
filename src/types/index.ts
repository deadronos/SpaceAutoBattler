import type { Archetype, World as ECSWorld } from 'miniplex';
import type { ColorRepresentation, Quaternion, Vector3 } from 'three';
import type { SeededRng } from '../utils/rng.js';

type RapierModule = (typeof import('@dimforge/rapier3d-compat'))['default'];
type RapierWorld = RapierModule['World'];
type Collider = RapierModule['Collider'];
type EventQueue = RapierModule['EventQueue'];
type RigidBody = RapierModule['RigidBody'];

export type Team = 'blue' | 'red';

export type ShipHull = 'fighter' | 'corvette' | 'frigate' | 'destroyer' | 'carrier';

export type StatusEffectTag = 'jammed' | 'shield-down' | 'engine-disrupted' | 'hacked';

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

export interface TransformComponent {
  transform: {
    position: Vector3;
    rotation: Quaternion;
    scale: number;
  };
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
  parent: ShipEntity;
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

export interface ProjectileComponent {
  team: Team;
  damage: number;
  ttl: number;
  maxTtl: number;
  speed: number;
  /** Material key or type identifier for rendering this projectile (optional) */
  bulletType?: string;
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

export interface ExplosionEvent {
  id: number;
  seed: number;
  faction: 'alliance' | 'reavers';
  hull: ShipHull;
  position: Vector3;
  radius: number;
  startTime: number;
  duration: number;
  lightDuration: number;
  lightFalloff: number;
  lightColor: ColorRepresentation;
  flashIntensity: number;
  shockwave: { delay: number; duration: number; maxRadius: number };
  fireball: { delay: number; duration: number };
  debris: { count: number; speed: [number, number] };
  particles: { sparks: number; plasma: number; smoke: number };
  palette: {
    flash: string;
    shockwave: string;
    fireballHot: string;
    smoke: string;
  };
  variant?: string;
  elapsed: number;
  lightElapsed: number;
}

export interface ExplosionConfigEntry {
  baseRadius: number;
  flashIntensity: number;
  lightColor: ColorRepresentation;
  lightFalloff: number;
  debrisCount: number;
  particleCounts: { sparks: number; plasma: number; smoke: number };
  palette: {
    flash: string;
    shockwave: string;
    fireballHot: string;
    smoke: string;
  };
  timing: {
    duration: number;
    lightDuration: number;
    shockwave: { delay: number; duration: number };
    fireball: { delay: number; duration: number };
    debrisSpeed: [number, number];
  };
}

export type EntityId = number;

export type AIIntent =
  | 'Attack'
  | 'Kite'
  | 'Escort'
  | 'Intercept'
  | 'Flee'
  | 'Regroup'
  | 'Reposition';

export interface AICommand {
  heading: Vector3;
  thrust: number;
  /** Optional lateral strafe input in range [-1, 1]. */
  strafe?: number;
  firePrimary: boolean;
  orbit?: number;
  targetId?: EntityId;
  ttl: number;
}

export interface AITraits {
  aggression: number;
  patience: number;
  dodge: number;
}

export interface AIState {
  profileId: string;
  intent: AIIntent;
  nextThinkAt: number;
  cooldowns: {
    dodgeAt: number;
    burstAt: number;
  };
  lod: 0 | 1 | 2;
  traitSeed: number;
  traits: AITraits;
  targetId?: EntityId;
  lastScore?: number;
  command: AICommand;
}

export interface BehaviorProfile {
  desiredRange: readonly [number, number];
  orbit: number;
  aggression: number;
  patience: number;
  dodgeFreq: number;
  classBias: Partial<Record<ShipHull, number>>;
  style: 'brawler' | 'kiter' | 'artillery' | 'escort';
  gates?: {
    ammoMin?: number;
    hpRetreatPct?: number;
  };
}

export type TeamPosture = 'aggressive' | 'hold' | 'retreat';

export interface AIBlackboard {
  tickIndex: number;
  teamPosture: Record<Team, TeamPosture>;
  allyCentroid: Record<Team, Vector3>;
  nearestEnemy: Map<EntityId, EntityId>;
  threatToVip: Map<EntityId, EntityId>;
  tmpVectors: Vector3[];
}

export interface AITeamAssignments {
  escorts: Map<EntityId, EntityId>;
}

export interface AIManagerState {
  enabled: boolean;
  tickInterval: number;
  maxPerTick: number;
  accumulator: number;
  tickIndex: number;
  cursor: number;
  slices: number;
  assignments: AITeamAssignments;
  metrics: AIMetrics;
}

export interface AIMetrics {
  totalDecisions: number;
  totalSkipped: number;
  budgetHits: number;
  lastDecisions: number;
  lastSkipped: number;
  lastSliceSize: number;
  lastTotalShips: number;
}

export interface GameEntity extends TransformComponent {
  id: number;
  rigidBody: RigidBody;
  collider: Collider;
  ship?: ShipComponent;
  projectile?: ProjectileComponent;
  turret?: TurretComponent;
  carrier?: CarrierComponent;
  ai?: AIState;
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
export type ProjectileEntity = GameEntity & { projectile: ProjectileComponent; direction: Vector3 };
export type TurretEntity = GameEntity & { turret: TurretComponent };

export interface GameQueries {
  ships: Archetype<GameEntity, ['ship']>;
  projectiles: Archetype<GameEntity, ['projectile']>;
  turrets: Archetype<GameEntity, ['turret']>;
}

export interface GameState {
  rapier: RapierModule;
  physicsWorld: RapierWorld;
  eventQueue: EventQueue;
  world: ECSWorld<GameEntity>;
  colliderLookup: Map<number, GameEntity>;
  nextEntityId: number;
  nextExplosionId: number;
  time: number;
  queries: GameQueries;
  /** Map from ship entity id -> set of turret entities mounted on that ship. Optional for tests/mocks. */
  turretsByShip?: Map<number, Set<TurretEntity>>;
  rng: SeededRng;
  /** Whether simulation is paused (authoritative mirror of UI state). */
  paused: boolean;
  /** Global time scale multiplier (1 = real-time). */
  timeScale: number;
  /** Simulation clock bookkeeping used for fixed-step integration and interpolation. */
  simulation: SimulationClock;
  ai: AIManagerState;
  blackboard: AIBlackboard;
  /** Flags mirrored from the UI store to keep deterministic playback. */
  uiFlags: HudUiFlags;
  /** Active explosion events pooled for renderer consumption. */
  explosions: ExplosionEvent[];
  /** Recycled explosion events available for reuse to maintain determinism. */
  explosionPool: ExplosionEvent[];
}

export interface HudUiFlags {
  /** Whether HUD health bars are currently enabled. */
  hudHealthBars: boolean;
}

export interface SimulationClock {
  /** Fixed step size in seconds for simulation updates. */
  step: number;
  /** Accumulated leftover time awaiting the next simulation step. */
  accumulator: number;
  /** Safety bound to avoid spiralling when frames are very long. */
  maxSubSteps: number;
  /** Normalised interpolation factor (0..1) between last and next sim states. */
  alpha: number;
  /** Monotonic tick counter incremented after each simulation step. */
  lastTickIndex: number;
  /** Simulation time at the start of the latest completed tick. */
  lastTickStart: number;
  /** Duration in seconds of the latest completed tick. */
  lastTickDuration: number;
}

export interface ShipBlueprint {
  hull: ShipHull;
  team: Team;
  position: Vector3;
  heading: number;
  parentCarrierId?: number;
}

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
  /** Optional default turret loadout for this hull. */
  turrets?: TurretSpec[];
  /** Motion characteristics for physics-based movement. */
  motion: MotionStats;
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

/** Parameters for a shield ripple kick emitted on impact. */
export interface ShieldRipple {
  /** Unit vector direction on the sphere surface in world space at impact moment. */
  dir: Vector3;
  /** Time when the ripple started (GameState.time). */
  t0: number;
  /** Visual strength (0..1). */
  amp: number;
}


