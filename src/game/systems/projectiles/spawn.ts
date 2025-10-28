import { Vector3 } from 'three';
import type { GameState, ShipEntity, ProjectileEntity } from '../../../types/index.js';
import type {
  ProjectileCategory,
  ProjectileComponent,
  ProjectileHomingConfig,
} from '../../../types/combat.js';
import { AI_CONFIG } from '../../config.js';
import { getEffectiveStats } from '../../progression.js';
import { adjustProjectileSpeedForHullAndBullet } from '../../utils/rangePolicy.js';
import {
  resolveProjectileInfo,
  type ResolvedProjectileInfo,
} from '../../../utils/projectileInfo.js';
import { type ProjectileBeamConfig } from '../../../config/projectiles.js';
import { orientQuaternionFromDirection } from '../../../utils/steering.js';
import { createBeamHitInfo } from './beam.js';
import { spawnProjectileEntity } from './physicsAdapter.js';

export interface FireProjectileOverride
  extends Partial<
    Pick<ShipEntity['ship'], 'damage' | 'projectileSpeed' | 'range' | 'bulletType' | 'damageType'>
  > {
  projectileCategory?: ProjectileCategory;
  homing?: ProjectileHomingConfig;
  armingTime?: number;
  aoeRadius?: number;
  beam?: ProjectileBeamConfig;
  targetId?: number;
}

export interface FireProjectileOptions {
  originPosition?: Vector3;
  override?: FireProjectileOverride;
  targetId?: number;
}

function resolveProjectileSpeed(
  origin: ShipEntity,
  speed: number,
  bulletType: string,
  override?: FireProjectileOverride,
): number {
  return adjustProjectileSpeedForHullAndBullet(
    origin.ship.hull,
    speed,
    bulletType,
    Boolean(override),
    AI_CONFIG,
  );
}

function populateProjectileBehaviour(
  projectile: ProjectileEntity,
  info: ResolvedProjectileInfo,
  category: ProjectileCategory,
  override: FireProjectileOverride | undefined,
  state: GameState,
  targetId: number | undefined,
): void {
  projectile.projectile.category = category;
  projectile.projectile.spawnTime = state.time;
  projectile.projectile.armingTime = override?.armingTime ?? info.config.armingTime;
  projectile.projectile.aoeRadius = override?.aoeRadius ?? info.config.aoeRadius;
  const homing = override?.homing ?? info.config.homing;
  if (homing) {
    projectile.projectile.homing = homing;
    projectile.projectile.targetId = override?.targetId ?? targetId;
  } else if (targetId != null) {
    projectile.projectile.targetId = targetId;
  }
  if (category === 'beam') {
    const beamConfig = override?.beam ?? info.beamConfig;
    if (beamConfig) {
      const runtime = projectile.projectile.beam ?? {
        ttl: beamConfig.ttl,
        maxLength: projectile.projectile.speed * projectile.projectile.maxTtl,
        width: beamConfig.width,
        hitPoint: undefined,
        applied: false,
      };
      runtime.ttl = beamConfig.ttl;
      runtime.width = beamConfig.width ?? runtime.width;
      runtime.maxLength =
        runtime.maxLength ?? projectile.projectile.speed * projectile.projectile.maxTtl;
      projectile.projectile.beam = runtime;
      projectile.projectile.ttl = beamConfig.ttl;
      projectile.projectile.maxTtl = beamConfig.ttl;
    }
  }
}

export function fireProjectile(
  state: GameState,
  origin: ShipEntity,
  direction: Vector3,
  opts?: FireProjectileOptions,
): void {
  const muzzleOffset = origin.transform.scale * 1.6;
  const startPosition = opts?.originPosition
    ? opts.originPosition.clone()
    : origin.transform.position.clone().addScaledVector(direction, muzzleOffset);
  const rotation = orientQuaternionFromDirection(direction);

  const bulletKey = opts?.override?.bulletType ?? origin.ship.bulletType;
  const info = resolveProjectileInfo(bulletKey);
  const category = opts?.override?.projectileCategory ?? info.category;
  const visualScale = info.visualScale;
  const colliderRadius = info.colliderRadius;

  let speed = opts?.override?.projectileSpeed ?? origin.ship.projectileSpeed;
  speed = resolveProjectileSpeed(origin, speed, info.key, opts?.override);
  const damage =
    (opts?.override?.damage ?? origin.ship.damage) *
    getEffectiveStats(origin.ship).damageMultiplier;
  const range = opts?.override?.range ?? origin.ship.range;
  const lifetime = speed > 0 ? Math.min(range / speed, 30) : (info.beamConfig?.ttl ?? 0.4);

  const spawnDirection = direction.clone();
  const targetId = opts?.override?.targetId ?? opts?.targetId;
  const damageType = opts?.override?.damageType ?? origin.ship.damageType;

  const beamInfo =
    category === 'beam' ? createBeamHitInfo(state, startPosition, direction, range) : null;

  const projectileData: ProjectileComponent = {
    team: origin.ship.team,
    damage,
    ttl: category === 'beam' ? (info.beamConfig?.ttl ?? lifetime) : lifetime,
    maxTtl: category === 'beam' ? (info.beamConfig?.ttl ?? lifetime) : lifetime,
    speed: category === 'beam' ? range / Math.max(info.beamConfig?.ttl ?? lifetime, 0.001) : speed,
    bulletType: opts?.override?.bulletType ?? origin.ship.bulletType,
    damageType,
    sourceId: origin.id,
  };

  spawnProjectileEntity(
    {
      state,
      position: startPosition,
      rotation,
      visualScale,
      colliderRadius,
      direction: spawnDirection,
      projectile: projectileData,
    },
    (projectile) => {
      if (beamInfo) {
        projectile.projectile.targetId = beamInfo.targetId;
        projectile.projectile.beam = {
          ttl: projectileData.ttl,
          maxLength: beamInfo.distance,
          width: info.beamConfig?.width,
          hitPoint: beamInfo.hitPoint.clone(),
          applied: false,
        };
      }

      populateProjectileBehaviour(projectile, info, category, opts?.override, state, targetId);
    },
  );
}
