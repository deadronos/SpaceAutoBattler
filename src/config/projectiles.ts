import type { BeamVisualConfig, HomingParams, ProjectileCategory } from '../types/combat.js';

export interface BeamShaderFalloffConfig {
  nearBrightness: number;
  farBrightness: number;
  falloffExponent: number;
  falloffBase: number;
}

const BEAM_SHADER_FALLOFF_DEFAULTS: BeamShaderFalloffConfig = {
  nearBrightness: 1.0,
  farBrightness: 0.5,
  falloffExponent: 1.2,
  falloffBase: 2.0,
};

function resolveNumber(value: number | undefined, fallback: number, min: number, max: number): number {
  if (!Number.isFinite(value ?? NaN)) return fallback;
  const clamped = value as number;
  if (clamped < min) return min;
  if (clamped > max) return max;
  return clamped;
}

function resolveBeamShaderFalloffConfig(overrides?: Partial<BeamShaderFalloffConfig>): BeamShaderFalloffConfig {
  const near = resolveNumber(overrides?.nearBrightness, BEAM_SHADER_FALLOFF_DEFAULTS.nearBrightness, 0.1, 8);
  const farCandidate = resolveNumber(overrides?.farBrightness, BEAM_SHADER_FALLOFF_DEFAULTS.farBrightness, 0.0, 8);
  const far = farCandidate > near ? near : farCandidate;
  const exponent = resolveNumber(overrides?.falloffExponent, BEAM_SHADER_FALLOFF_DEFAULTS.falloffExponent, 0.1, 6);
  const base = resolveNumber(overrides?.falloffBase, BEAM_SHADER_FALLOFF_DEFAULTS.falloffBase, 1.0, 4.0);

  return {
    nearBrightness: near,
    farBrightness: far,
    falloffExponent: exponent,
    falloffBase: base,
  };
}

export const PROJECTILE_BEAM_SHADER_CONFIG = resolveBeamShaderFalloffConfig();

export interface ProjectileConfigItem {
  visualScale: number; // transform.scale applied to projectile
  colliderRadius?: number; // collider ball radius (overrides derived)
  baseGeometryRadius?: number; // base geometry radius in Projectile mesh
  visualMultiplier?: number; // multiplier applied in renderer for fine-tuning
  category?: ProjectileCategory; // behaviour category
  homing?: HomingParams; // homing parameters (missiles)
  armingTime?: number; // seconds before projectile arms
  aoeRadius?: number; // explosion radius (torpedoes)
  beam?: BeamVisualConfig; // beam visual configuration
}

export const PROJECTILE_CONFIG: Record<string, ProjectileConfigItem> = {
  'bullet:laser': {
    visualScale: 0.5,
    colliderRadius: 0.5 * 1.2,
    baseGeometryRadius: 0.5,
    visualMultiplier: 1.0,
    category: 'bullet',
  },
  'bullet:plasma': {
    visualScale: 0.6,
    colliderRadius: 0.6 * 1.2,
    baseGeometryRadius: 0.5,
    visualMultiplier: 1.05,
    category: 'bullet',
  },
  'bullet:ion': {
    visualScale: 0.5,
    colliderRadius: 0.5 * 1.2,
    baseGeometryRadius: 0.5,
    visualMultiplier: 1.0,
    category: 'bullet',
  },
  'bullet:heavy': {
    visualScale: 0.7,
    colliderRadius: 0.7 * 1.2,
    baseGeometryRadius: 0.6,
    visualMultiplier: 1.25,
    category: 'bullet',
  },
  'missile:seeker': {
    visualScale: 0.78,
    colliderRadius: 0.38,
    baseGeometryRadius: 0.34,
    visualMultiplier: 1.3,
    category: 'missile',
    homing: { turnRate: Math.PI },
    armingTime: 0.75,
  },
  'torpedo:heavy': {
    visualScale: 1.05,
    colliderRadius: 0.55,
    baseGeometryRadius: 0.5,
    visualMultiplier: 1.35,
    category: 'torpedo',
    armingTime: 1.5,
    aoeRadius: 6,
  },
  'beam:laser': {
    visualScale: 1.0,
    baseGeometryRadius: 0.35,
    visualMultiplier: 1.0,
    category: 'beam',
    // Increase TTL to improve visual visibility (was 0.12)
    beam: { ttl: 0.45, length: 30, width: 0.9 },
  },
};

export const DEFAULT_PROJECTILE_CONFIG: ProjectileConfigItem = {
  visualScale: 0.2,
  colliderRadius: 0.24,
  baseGeometryRadius: 0.5,
  visualMultiplier: 1.0,
  category: 'bullet',
};

export function getProjectileConfig(bulletType?: string | null): ProjectileConfigItem {
  return PROJECTILE_CONFIG[bulletType ?? ''] ?? DEFAULT_PROJECTILE_CONFIG;
}

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

export function getProjectileCategory(bulletType?: string | null): ProjectileCategory {
  const config = getProjectileConfig(bulletType);
  return config.category ?? DEFAULT_PROJECTILE_CONFIG.category ?? 'bullet';
}

export function getProjectileBeamConfig(bulletType?: string | null): BeamVisualConfig | undefined {
  const config = getProjectileConfig(bulletType);
  return config.beam;
}
