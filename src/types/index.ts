import type { Archetype, World as ECSWorld } from 'miniplex';
import type { Quaternion, Vector3 } from 'three';
import type { SeededRng } from '../utils/rng.js';

type RapierModule = (typeof import('@dimforge/rapier3d-compat'))['default'];
type RapierWorld = RapierModule['World'];
type Collider = RapierModule['Collider'];
type EventQueue = RapierModule['EventQueue'];
type RigidBody = RapierModule['RigidBody'];

export type Team = 'blue' | 'red';

export type ShipHull = 'fighter' | 'corvette' | 'frigate' | 'destroyer' | 'carrier';

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
  time: number;
  queries: GameQueries;
  /** Map from ship entity id -> set of turret entities mounted on that ship. Optional for tests/mocks. */
  turretsByShip?: Map<number, Set<TurretEntity>>;
  rng: SeededRng;
  /** Whether simulation is paused (authoritative mirror of UI state). */
  paused: boolean;
  /** Global time scale multiplier (1 = real-time). */
  timeScale: number;
  ai: AIManagerState;
  blackboard: AIBlackboard;
}

export interface ShipBlueprint {
  hull: ShipHull;
  team: Team;
  position: Vector3;
  heading: number;
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
