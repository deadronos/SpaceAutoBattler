import { Matrix4, Vector3 } from 'three';
import type { ProjectileEntity } from '../types/index.js';
import type { ProjectileCategory } from '../types/combat.js';
import {
  DEFAULT_PROJECTILE_CONFIG,
  PROJECTILE_CONFIG,
  getProjectileConfig,
  type ProjectileBeamConfig,
  type ProjectileConfigItem,
} from '../config/projectiles.js';
import {
  getProjectileGeometry,
  type ProjectileGeometryMetadata,
} from './projectileGeometries.js';

const FALLBACK_PROJECTILE_KEY = 'bullet:laser';
const TEMP_HIT_VECTOR = new Vector3();

export interface ResolvedProjectileGeometryMetadata {
  category?: ProjectileCategory;
  baseRadius?: number;
  baseWidth?: number;
  baseLength?: number;
}

export interface ResolvedProjectileInfo {
  key: string;
  config: ProjectileConfigItem;
  category: ProjectileCategory;
  visualScale: number;
  visualMultiplier: number;
  colliderRadius: number;
  metadata: ResolvedProjectileGeometryMetadata;
  beamConfig?: ProjectileBeamConfig;
}

interface ResolveProjectileInfoOptions {
  metadata?: Partial<ResolvedProjectileGeometryMetadata> | null;
}

export interface ComputeBeamTransformParams {
  projectile: ProjectileEntity;
  info: ResolvedProjectileInfo;
  matrix?: Matrix4;
  scratchScale?: Vector3;
  scratchPosition?: Vector3;
  scratchDirection?: Vector3;
}

export interface BeamTransformResult {
  matrix: Matrix4;
  widthScale: number;
  lengthScale: number;
}

function normalizeProjectileKey(key?: string | null): string {
  const candidate = key ?? FALLBACK_PROJECTILE_KEY;
  if (Object.prototype.hasOwnProperty.call(PROJECTILE_CONFIG, candidate)) {
    return candidate;
  }
  return FALLBACK_PROJECTILE_KEY;
}

function resolveGeometryMetadata(
  key: string,
  opts?: Partial<ResolvedProjectileGeometryMetadata> | null,
): ResolvedProjectileGeometryMetadata {
  const geometry = getProjectileGeometry(key);
  const raw = (geometry.userData.projectile ?? {}) as ProjectileGeometryMetadata | undefined;
  return {
    category: (opts?.category ?? raw?.category) as ProjectileCategory | undefined,
    baseRadius: opts?.baseRadius ?? raw?.baseRadius,
    baseWidth: opts?.baseWidth ?? raw?.baseWidth,
    baseLength: opts?.baseLength ?? raw?.baseLength,
  };
}

export function resolveProjectileInfo(
  key?: string | null,
  opts?: ResolveProjectileInfoOptions,
): ResolvedProjectileInfo {
  const normalizedKey = normalizeProjectileKey(key);
  const config = getProjectileConfig(normalizedKey);
  const geometryMetadata = resolveGeometryMetadata(normalizedKey, opts?.metadata);

  const baseRadius =
    geometryMetadata.baseRadius ??
    config.baseGeometryRadius ??
    DEFAULT_PROJECTILE_CONFIG.baseGeometryRadius ??
    0.5;
  const computedCategory =
    geometryMetadata.category ?? config.category ?? 'bullet';
  const baseWidth =
    geometryMetadata.baseWidth ??
    (baseRadius != null ? baseRadius * 2 : undefined);
  const beamLengthFallback = Math.max(
    1,
    (config.visualScale ?? DEFAULT_PROJECTILE_CONFIG.visualScale ?? 1) * 12,
  );
  const baseLength =
    geometryMetadata.baseLength ??
    (computedCategory === 'beam'
      ? beamLengthFallback
      : baseWidth ?? baseRadius * 2);

  const visualScale = config.visualScale ?? DEFAULT_PROJECTILE_CONFIG.visualScale ?? 0.2;
  const visualMultiplier = config.visualMultiplier ?? 1;
  const colliderRadius =
    config.colliderRadius ?? Math.max(0.08, visualScale * 1.2);

  const metadata: ResolvedProjectileGeometryMetadata = {
    category: computedCategory,
    baseRadius,
    baseWidth,
    baseLength: baseLength && baseLength > 0 ? baseLength : 1,
  };

  return {
    key: normalizedKey,
    config,
    category: computedCategory,
    visualScale,
    visualMultiplier,
    colliderRadius,
    metadata,
    beamConfig: config.beam,
  };
}

export function resolveProjectileCategory(key?: string | null): ProjectileCategory {
  return resolveProjectileInfo(key).category;
}

export function computeBeamTransform({
  projectile,
  info,
  matrix,
  scratchScale,
  scratchPosition,
  scratchDirection,
}: ComputeBeamTransformParams): BeamTransformResult {
  const beam = projectile.projectile.beam;
  if (!beam) {
    throw new Error('computeBeamTransform requires a beam projectile.');
  }

  const workingMatrix = matrix ?? new Matrix4();
  const scale = scratchScale ?? new Vector3();
  const position = scratchPosition ?? new Vector3();
  const directionScratch = scratchDirection ?? TEMP_HIT_VECTOR;

  const baseScale = projectile.transform.scale * info.visualMultiplier;
  const baseWidth = info.metadata.baseWidth && info.metadata.baseWidth > 0
    ? info.metadata.baseWidth
    : baseScale;
  const configuredWidth =
    beam.width ?? info.beamConfig?.width ?? baseWidth ?? baseScale;
  const widthScale = baseWidth && baseWidth > 0 ? configuredWidth / baseWidth : baseScale;

  let beamLength = beam.maxLength ?? projectile.projectile.speed * projectile.projectile.maxTtl;
  if (beam.hitPoint) {
    directionScratch
      .copy(beam.hitPoint)
      .sub(projectile.transform.position);
    beamLength = directionScratch.length();
  }
  if (!Number.isFinite(beamLength) || beamLength <= 0) {
    beamLength = projectile.projectile.speed * Math.max(projectile.projectile.maxTtl, 0);
  }
  beamLength = Math.max(0.1, beamLength);

  const baseLength = info.metadata.baseLength && info.metadata.baseLength > 0
    ? info.metadata.baseLength
    : 1;
  const lengthScale = baseLength > 0 ? beamLength / baseLength : beamLength;

  scale.set(widthScale, widthScale, lengthScale);
  position
    .copy(projectile.transform.position)
    .addScaledVector(projectile.direction, beamLength / 2);
  workingMatrix.compose(position, projectile.transform.rotation, scale);

  return {
    matrix: workingMatrix,
    widthScale,
    lengthScale,
  };
}

export type { ProjectileGeometryMetadata } from './projectileGeometries.js';
