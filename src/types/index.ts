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
	// Add other top-level state fields as needed
}

export default {};
