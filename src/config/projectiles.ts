import type { ProjectileCategory, ProjectileHomingConfig } from '../types/combat.js';

/**
 * Beam-specific configuration parameters.
 */
export interface ProjectileBeamConfig {
  ttl: number;
  width?: number;
}

/**
 * Proximity fuse configuration for projectiles.
 */
export interface ProjectileProximityFuseConfig {
  radius: number;
}

/**
 * Configuration for a specific projectile type.
 */
export interface ProjectileConfigItem {
  visualScale: number; // transform.scale applied to projectile
  colliderRadius?: number; // collider ball radius (overrides derived)
  baseGeometryRadius?: number; // base geometry radius in Projectile mesh
  visualMultiplier?: number; // multiplier applied in renderer for fine-tuning
  category?: ProjectileCategory;
  homing?: ProjectileHomingConfig;
  armingTime?: number;
  aoeRadius?: number;
  beam?: ProjectileBeamConfig;
  proximityFuse?: ProjectileProximityFuseConfig;
}

/**
 * Registry of all projectile configurations.
 */
export const PROJECTILE_CONFIG: Record<string, ProjectileConfigItem> = {
  'bullet:flak': {
    category: 'bullet',
    visualScale: 0.8,
    colliderRadius: 0.4,
    baseGeometryRadius: 0.4,
    visualMultiplier: 1.0,
    aoeRadius: 8,
    proximityFuse: { radius: 4 },
  },
  'bullet:laser': {
    category: 'bullet',
    visualScale: 0.5,
    colliderRadius: 0.5 * 1.2,
    baseGeometryRadius: 0.5,
    visualMultiplier: 1.0,
  },
  'bullet:plasma': {
    category: 'bullet',
    visualScale: 0.6,
    colliderRadius: 0.6 * 1.2,
    baseGeometryRadius: 0.5,
    visualMultiplier: 1.05,
  },
  'bullet:ion': {
    category: 'bullet',
    visualScale: 0.5,
    colliderRadius: 0.5 * 1.2,
    baseGeometryRadius: 0.5,
    visualMultiplier: 1.0,
  },
  'bullet:heavy': {
    category: 'bullet',
    visualScale: 0.7,
    colliderRadius: 0.7 * 1.2,
    baseGeometryRadius: 0.6,
    visualMultiplier: 1.25,
  },
  'missile:light': {
    category: 'missile',
    visualScale: 0.9,
    colliderRadius: 0.45,
    baseGeometryRadius: 0.35,
    visualMultiplier: 1.1,
    homing: { turnRate: Math.PI / 2, lead: true },
    armingTime: 1.2,
  },
  'torpedo:standard': {
    category: 'torpedo',
    visualScale: 1.2,
    colliderRadius: 0.7,
    baseGeometryRadius: 0.5,
    visualMultiplier: 1.15,
    armingTime: 0.8,
    aoeRadius: 12,
  },
  'beam:laser': {
    category: 'beam',
    visualScale: 0.4,
    colliderRadius: 0.3,
    baseGeometryRadius: 0.3,
    visualMultiplier: 1.0,
    beam: {
      ttl: 0.4,
      width: 0.6,
    },
  },
};

/**
 * Default fallback configuration for projectiles.
 */
export const DEFAULT_PROJECTILE_CONFIG: ProjectileConfigItem = {
  visualScale: 0.2,
  colliderRadius: 0.24,
  baseGeometryRadius: 0.5,
  visualMultiplier: 1.0,
};

/**
 * Retrieves the configuration for a given projectile type.
 *
 * @param {string | null} [bulletType] - The projectile type key.
 * @returns {ProjectileConfigItem} The configuration object.
 */
export function getProjectileConfig(bulletType?: string | null): ProjectileConfigItem {
  return PROJECTILE_CONFIG[bulletType ?? ''] ?? DEFAULT_PROJECTILE_CONFIG;
}

/**
 * Retrieves the category for a given projectile type.
 *
 * @param {string | null} [bulletType] - The projectile type key.
 * @returns {ProjectileCategory} The projectile category.
 */
export function getProjectileCategory(bulletType?: string | null): ProjectileCategory {
  const config = getProjectileConfig(bulletType);
  return config.category ?? 'bullet';
}

/**
 * Retrieves the base geometry radius for a given projectile type.
 *
 * @param {string | null} [bulletType] - The projectile type key.
 * @returns {number} The base radius.
 */
export function getProjectileBaseRadius(bulletType?: string | null): number {
  const config = getProjectileConfig(bulletType);
  if (typeof config.baseGeometryRadius === 'number') {
    return config.baseGeometryRadius;
  }
  if (typeof DEFAULT_PROJECTILE_CONFIG.baseGeometryRadius === 'number') {
    return DEFAULT_PROJECTILE_CONFIG.baseGeometryRadius;
  }
  return 0.5;
}
