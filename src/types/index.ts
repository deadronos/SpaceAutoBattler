// Centralized types re-exports for the workspace
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

export default {};
