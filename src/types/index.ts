// Centralized types re-exports for the workspace
import type { Ship, Bullet } from '../entities';
// Centralized types re-exports for the workspace

// Core simulation and config types
export type { ShipSpec, CannonSpec, ProgressionConfig } from '../config/types';
export type { ShipConfigMap } from '../config/entitiesConfig';
export type { AssetsConfigType, Shape2D } from '../config/assets/assetsConfig';
export type { TeamsConfig } from '../config/teamsConfig';
export type { RendererConfig } from '../config/rendererConfig';
// DisplayConfig is not exported as a named type; skip re-export

// Domain types
export type { Cannon, Ship, Bullet } from '../entities';
export type { GameManagerOptions } from '../gamemanager';

// Canonical GameState type for simulation and renderer contract
export interface GameState {
	t: number;
	ships: Ship[];
	bullets: Bullet[];
	explosions: any[];
	shieldHits: any[];
	healthHits: any[];
	// Optional/extended event arrays (add as needed)
	particles?: any[];
	stars?: any[];
	flashes?: any[];
	shieldFlashes?: any[];
	healthFlashes?: any[];
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
}

export default {};
