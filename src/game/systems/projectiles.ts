import { Quaternion, Vector3 } from 'three';
import type { GameState, ShipEntity, ProjectileEntity } from '../../types/index.js';
import type { ProjectileCategory, ProjectileHomingConfig } from '../../types/combat.js';
import {
  resolveProjectileCategory,
  resolveProjectileInfo,
  type ResolvedProjectileInfo,
} from '../../utils/projectileInfo.js';
import { type ProjectileBeamConfig } from '../../config/projectiles.js';
import { clampToWorld, AI_CONFIG } from '../config.js';
import { getEffectiveStats } from '../progression.js';
import { enqueuePostPhysicsMutation } from '../simulationQueue.js';
import type { KinematicBody } from '../physics/safeKinematics.js';
import {
  deferSetNextKinematicTranslation,
  deferSetNextKinematicRotation,
} from '../physics/safeKinematics.js';

export const FORWARD = new Vector3(0, 0, 1);
export const TEMP_DIR = new Vector3();
export const TEMP_POS = new Vector3();
const TEMP_TARGET = new Vector3();
const TEMP_LEAD = new Vector3();

interface FireProjectileOverride
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

interface FireProjectileOptions {
  originPosition?: Vector3;
  override?: FireProjectileOverride;
  targetId?: number;
}

function findShipById(state: GameState, id: number | undefined | null): ShipEntity | undefined {
  if (id == null) return undefined;
  const ships = state.queries.ships.entities as ShipEntity[];
  return ships.find((s) => s.id === id);
}

function steerProjectileTowardTarget(
  projectile: ProjectileEntity,
  target: ShipEntity,
  homing: ProjectileHomingConfig,
  delta: number,
): void {
  const currentDir = projectile.direction;
  const desired = TEMP_TARGET.copy(target.transform.position).sub(projectile.transform.position);
  if (desired.lengthSq() <= 1e-6) {
    return;
  }
  desired.normalize();

  if (homing.lead) {
    TEMP_LEAD.copy(target.ship.velocity).normalize().multiplyScalar(0.5);
    desired.add(TEMP_LEAD).normalize();
  }

  const angle = currentDir.angleTo(desired);
  if (angle < 1e-5) {
    return;
  }
  const maxTurn = Math.max(0, homing.turnRate) * delta;
  const t = Math.min(1, angle > 0 ? maxTurn / angle : 1);
  currentDir.lerp(desired, t).normalize();
  projectile.direction = currentDir;
  projectile.transform.rotation.setFromUnitVectors(FORWARD, currentDir);
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

export function advanceProjectiles(state: GameState, delta: number): void {
  const projectiles = state.queries.projectiles.entities as ProjectileEntity[];
  for (const projectile of projectiles) {
    const category =
      projectile.projectile.category ?? resolveProjectileCategory(projectile.projectile.bulletType);
    if (category === 'beam') {
      continue;
    }

    if (projectile.projectile.homing && projectile.projectile.targetId != null) {
      const target = findShipById(state, projectile.projectile.targetId);
      if (target) {
        steerProjectileTowardTarget(projectile, target, projectile.projectile.homing, delta);
      }
    }

    const move = projectile.projectile.speed * delta;
    const direction = projectile.direction;
    const current = projectile.transform.position;
    const next = TEMP_POS.copy(current).addScaledVector(direction, move);
    clampToWorld(next);

    projectile.transform.position.copy(next);
    const rotation = projectile.transform.rotation;
    deferSetNextKinematicTranslation(
      state,
      projectile.rigidBody as unknown as KinematicBody,
      next.x,
      next.y,
      next.z,
    );
    deferSetNextKinematicRotation(
      state,
      projectile.rigidBody as unknown as KinematicBody,
      rotation.x,
      rotation.y,
      rotation.z,
      rotation.w,
    );
  }
}

function resolveProjectileSpeed(
  origin: ShipEntity,
  speed: number,
  bulletType: string,
  override?: FireProjectileOverride,
): number {
  if (AI_CONFIG.rangePolicy !== 'v0.1.1-exp' || override) {
    return speed;
  }
  let adjusted = speed;
  if (origin.ship.hull === 'destroyer' || origin.ship.hull === 'carrier') {
    adjusted *= 1.05;
  } else if (origin.ship.hull === 'fighter') {
    adjusted *= 1.02;
  } else if (origin.ship.hull === 'corvette') {
    adjusted *= 0.98;
  } else if (origin.ship.hull === 'frigate') {
    adjusted *= 0.96;
  }

  if (bulletType.includes('laser')) {
    adjusted *= 0.97;
  } else if (bulletType.includes('heavy') || bulletType.includes('ion')) {
    adjusted *= 1.03;
  }
  return adjusted;
}

function createBeamHitInfo(
  state: GameState,
  start: Vector3,
  direction: Vector3,
  range: number,
): { hitPoint: Vector3; targetId?: number; distance: number } {
  const ray = new state.rapier.Ray(start, direction);
  const hit = state.physicsWorld.castRay(ray, range, true);
  if (!hit) {
    return { hitPoint: start.clone().addScaledVector(direction, range), distance: range };
  }

  const collider = hit.collider;
  const handle = (collider as { handle?: number } | undefined)?.handle;
  const entity =
    handle != null
      ? (state.colliderLookup.get(handle) as ProjectileEntity | ShipEntity | undefined)
      : undefined;
  const distance = (hit as { toi?: number; timeOfImpact?: number }).toi ?? hit.timeOfImpact;
  const hitPoint = start.clone().addScaledVector(direction, distance);
  const targetId = entity?.ship ? entity.id : undefined;
  return { hitPoint, targetId, distance };
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
  const rotation = new Quaternion().setFromUnitVectors(FORWARD, direction);

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
  const rotationComponents = { x: rotation.x, y: rotation.y, z: rotation.z, w: rotation.w };
  const positionComponents = { x: startPosition.x, y: startPosition.y, z: startPosition.z };

  const targetId = opts?.override?.targetId ?? opts?.targetId;
  const damageType = opts?.override?.damageType ?? origin.ship.damageType;

  const beamInfo =
    category === 'beam' ? createBeamHitInfo(state, startPosition, direction, range) : null;

  const projectileData = {
    team: origin.ship.team,
    damage,
    ttl: category === 'beam' ? (info.beamConfig?.ttl ?? lifetime) : lifetime,
    speed: category === 'beam' ? range / Math.max(info.beamConfig?.ttl ?? lifetime, 0.001) : speed,
    bulletType: opts?.override?.bulletType ?? origin.ship.bulletType,
    damageType,
    sourceId: origin.id,
  };

  enqueuePostPhysicsMutation(state, () => {
    const bodyDesc = state.rapier.RigidBodyDesc.kinematicPositionBased()
      .setTranslation(positionComponents.x, positionComponents.y, positionComponents.z)
      .setRotation(rotationComponents);
    const body = state.physicsWorld.createRigidBody(bodyDesc);

    const colliderDesc = state.rapier.ColliderDesc.ball(colliderRadius)
      .setActiveEvents(state.rapier.ActiveEvents.COLLISION_EVENTS)
      .setActiveCollisionTypes(state.rapier.ActiveCollisionTypes.ALL);
    const collider = state.physicsWorld.createCollider(colliderDesc, body);

    const projectile = state.world.add({
      id: state.nextEntityId++,
      rigidBody: body,
      collider,
      transform: {
        position: new Vector3(positionComponents.x, positionComponents.y, positionComponents.z),
        rotation: new Quaternion(
          rotationComponents.x,
          rotationComponents.y,
          rotationComponents.z,
          rotationComponents.w,
        ),
        scale: visualScale,
      },
      projectile: {
        team: projectileData.team,
        damage: projectileData.damage,
        ttl: projectileData.ttl,
        maxTtl: projectileData.ttl,
        speed: projectileData.speed,
        bulletType: projectileData.bulletType,
        damageType: projectileData.damageType,
        sourceId: projectileData.sourceId,
      },
      direction: spawnDirection.clone(),
    });

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

    if (collider?.handle != null) {
      state.colliderLookup.set(collider.handle, projectile);
    }
  });
}
