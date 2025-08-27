// Centralized types re-exports for the workspace
import type { Ship, Bullet, ExplosionEffect, ShieldHitEffect, HealthHitEffect } from '../entities';

// 3D type definitions
export type Vec3 = { x: number; y: number; z: number };

export interface ComponentPosition {
  x: number;  // Relative to ship center (-1 to 1)
  y: number;  // Relative to ship center (-1 to 1)
  z: number;  // Relative to ship center (-1 to 1)
}

export interface Ship3D {
  id: string;
  type: string;
  team?: string;
  position: Vec3;
  velocity: Vec3;
  acceleration?: Vec3;
  rotation?: { x: number; y: number; z: number };
  quaternion?: { x: number; y: number; z: number; w: number };
  scale?: number;
  assetKey?: string;
  collisionRadius?: number;

  // Component positions (relative to ship center, in ship-local coordinates)
  turrets?: ComponentPosition[];
  engines?: ComponentPosition[];
  hardpoints?: ComponentPosition[]; // Generic attachment points

  // Ship configuration
  shipScale?: number;     // Individual ship scale multiplier
  baseScale?: number;     // Base archetype scale
}

export interface GameState3D {
  ships: Ship3D[];
  flashes?: any[];
  t?: number;
  camera?: {
    position: Vec3;
    target?: Vec3;
    fov?: number;
    near?: number;
    far?: number;
  };
  bounds?: {
    width: number;
    height: number;
    depth: number;
    wrap: { x: boolean; y: boolean; z: boolean };
  };
  // allow arbitrary other fields from legacy GameState
  [k: string]: any;
}

// Core simulation and config types
export type { ShipSpec, CannonSpec, ProgressionConfig } from '../config/types';
export type { ShipConfigMap } from '../config/entitiesConfig';
export type { AssetsConfigType, Shape2D } from '../config/assets/assetsConfig';
export type { TeamsConfig } from '../config/teamsConfig';
export type { RendererConfig } from '../config/rendererConfig';
// DisplayConfig is not exported as a named type; skip re-export

// Domain types
export type { Cannon, Ship, Bullet, ExplosionEffect, ShieldHitEffect, HealthHitEffect } from '../entities';
export type { GameManagerOptions } from '../gamemanager.d';
// Re-export pool types as type-only to make them discoverable from the barrel.
export type { PoolEntry, TexturePoolEntry } from './pool';
export type { OverflowStrategy } from './pool';
// Re-export pooled helper types from entities for convenience (type-only)
// Pooled helper types are defined in the pools implementation; re-export them
// type-only from that module so callers can import from the barrel.
export type { Pooled, PooledFactory } from '../pools/assetPool';

// Canonical GameState type for simulation and renderer contract
export interface GameState {
	t: number;
	ships: Ship[];
	// Cached per-team counts to avoid per-frame array filtering in UI hot paths
	teamCounts: { [team: string]: number };
	// Map for fast ID -> Ship lookup to avoid O(n) searches in hot paths
	shipMap?: Map<number, Ship>;
	bullets: Bullet[];
	explosions: ExplosionEffect[];
	shieldHits: ShieldHitEffect[];
	healthHits: HealthHitEffect[];
	// Optional/extended event arrays (add as needed)
	 particles: any[];
	 stars?: any[];
	 flashes: any[];
	 shieldFlashes: any[];
	 healthFlashes: any[];
	engineTrailsEnabled?: boolean;
	damageEvents?: any[];
	starCanvas?: HTMLCanvasElement;
	// --- Asset Pooling ---
	assetPool: {
		// Per-key texture pool entries track free list, allocated count, optional per-key config and disposer
		textures: Map<string, {
			freeList: WebGLTexture[];
			allocated: number;
			config?: { max?: number; strategy?: 'discard-oldest'|'grow'|'error' };
			disposer?: (t: WebGLTexture) => void;
		}>;
		sprites: Map<string, {
			freeList: any[];
			allocated: number;
			config?: { max?: number; strategy?: 'discard-oldest'|'grow'|'error' };
			disposer?: (s: any) => void;
		}>;
		effects: Map<string, {
			freeList: any[];
			allocated: number;
			config?: { max?: number; strategy?: 'discard-oldest'|'grow'|'error' };
			disposer?: (e: any) => void;
		}>;
		// Optional counts used to track total allocated per key (in-use + free)
		counts?: {
			textures: Map<string, number>;
			sprites: Map<string, number>;
			effects: Map<string, number>;
		};
		config: {
			texturePoolSize: number;
			spritePoolSize: number;
			effectPoolSize: number;
			// Optional overflow strategy settings used by pooling helpers
			textureOverflowStrategy?: 'discard-oldest' | 'grow' | 'error';
			spriteOverflowStrategy?: 'discard-oldest' | 'grow' | 'error';
			effectOverflowStrategy?: 'discard-oldest' | 'grow' | 'error';
		};
	};
	// 3D-specific fields
	bounds?: { width: number; height: number; depth: number; wrap: { x: boolean; y: boolean; z: boolean } };
}

export default {};
