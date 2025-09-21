export interface ProjectileConfigItem {
  visualScale: number; // transform.scale applied to projectile
  colliderRadius?: number; // collider ball radius (overrides derived)
  baseGeometryRadius?: number; // base geometry radius in Projectile mesh
  visualMultiplier?: number; // multiplier applied in renderer for fine-tuning
}

export const PROJECTILE_CONFIG: Record<string, ProjectileConfigItem> = {
  'bullet:laser': { visualScale: 0.18, colliderRadius: 0.18 * 1.2, baseGeometryRadius: 0.5, visualMultiplier: 1.0 },
  'bullet:plasma': { visualScale: 0.22, colliderRadius: 0.22 * 1.2, baseGeometryRadius: 0.5, visualMultiplier: 1.05 },
  'bullet:ion': { visualScale: 0.16, colliderRadius: 0.16 * 1.2, baseGeometryRadius: 0.5, visualMultiplier: 1.0 },
  'bullet:heavy': { visualScale: 0.36, colliderRadius: 0.36 * 1.2, baseGeometryRadius: 0.6, visualMultiplier: 1.25 }
};

export const DEFAULT_PROJECTILE_CONFIG: ProjectileConfigItem = { visualScale: 0.2, colliderRadius: 0.24, baseGeometryRadius: 0.5, visualMultiplier: 1.0 };
