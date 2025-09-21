import type { Archetype, World as ECSWorld } from 'miniplex';
import type { Quaternion, Vector3 } from 'three';
import type { SeededRng } from '../utils/rng.js';

type RapierModule = typeof import('@dimforge/rapier3d-compat')['default'];
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
  cooldown: number;
  fireRate: number;
  damage: number;
  projectileSpeed: number;
  range: number;
  speed: number;
}

export interface ProjectileComponent {
  team: Team;
  damage: number;
  ttl: number;
  maxTtl: number;
  speed: number;
}

export interface GameEntity extends TransformComponent {
  id: number;
  rigidBody: RigidBody;
  collider: Collider;
  ship?: ShipComponent;
  projectile?: ProjectileComponent;
  /** Unit direction vector used for projectile integration. */
  direction?: Vector3;
  /** Identifier of the model to render for this entity. */
  model?: ShipHull;
}

export type ShipEntity = GameEntity & { ship: ShipComponent };
export type ProjectileEntity = GameEntity & { projectile: ProjectileComponent; direction: Vector3 };

export interface GameQueries {
  ships: Archetype<GameEntity, ['ship']>;
  projectiles: Archetype<GameEntity, ['projectile']>;
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
  rng: SeededRng;
  /** Whether simulation is paused (authoritative mirror of UI state). */
  paused: boolean;
  /** Global time scale multiplier (1 = real-time). */
  timeScale: number;
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
  damage: number;
  fireRate: number;
  projectileSpeed: number;
  range: number;
  speed: number;
  scale: number;
}
