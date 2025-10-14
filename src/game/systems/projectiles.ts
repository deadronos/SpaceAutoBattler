import { Quaternion, Vector3 } from 'three';
import type { GameState, ShipEntity, ProjectileEntity } from '../../types/index.js';
import { clampToWorld, AI_CONFIG } from '../config.js';
import {
  PROJECTILE_CONFIG,
  DEFAULT_PROJECTILE_CONFIG,
  getProjectileCategory,
  getProjectileBeamConfig,
} from '../../config/projectiles.js';
import { getEffectiveStats } from '../progression.js';
import { enqueuePostPhysicsMutation } from '../simulationQueue.js';
import type { KinematicBody } from '../physics/safeKinematics.js';
import { deferSetNextKinematicTranslation } from '../physics/safeKinematics.js';
import type { BeamRuntimeState, ProjectileCategory } from '../../types/combat.js';

export const FORWARD = new Vector3(0, 0, 1);
export const TEMP_DIR = new Vector3();
export const TEMP_POS = new Vector3();

export function advanceProjectiles(state: GameState, delta: number): void {
  const projectiles = state.queries.projectiles.entities as ProjectileEntity[];
  const ships = state.queries.ships.entities as ShipEntity[];
  for (const projectile of projectiles) {
    const component = projectile.projectile;
    if (!component.armed) {
      const armingTime = component.armingTime ?? 0;
      if (armingTime <= 0 || state.time - component.spawnTime >= armingTime) {
        component.armed = true;
      }
    }

    const homing = component.homing;
    if (homing && component.targetId != null) {
      const target = ships.find((ship) => ship.id === component.targetId);
      if (target) {
        const desired = TEMP_DIR.copy(target.transform.position).sub(projectile.transform.position);
        if (desired.lengthSq() > 1e-6) {
          desired.normalize();
          const currentDir = projectile.direction;
          const dot = Math.max(-1, Math.min(1, currentDir.dot(desired)));
          const angle = Math.acos(dot);
          const maxTurn = Math.max(0, homing.turnRate) * delta;
          if (angle > 1e-5 && maxTurn > 0) {
            const t = Math.min(1, maxTurn / angle);
            currentDir.lerp(desired, t).normalize();
            projectile.transform.rotation.setFromUnitVectors(FORWARD, currentDir);
          }
        }
      }
    }

    if (component.category === 'beam') {
      const beamState = component.beam;
      if (component.sourceId != null && beamState) {
        const source = ships.find((ship) => ship.id === component.sourceId);
        if (source) {
          if (beamState.localOrigin) {
            const worldOrigin = TEMP_POS.copy(beamState.localOrigin)
              .multiplyScalar(source.transform.scale)
              .applyQuaternion(source.transform.rotation)
              .add(source.transform.position);
            clampToWorld(worldOrigin);
            projectile.transform.position.copy(worldOrigin);
            deferSetNextKinematicTranslation(
              state,
              projectile.rigidBody as unknown as KinematicBody,
              worldOrigin.x,
              worldOrigin.y,
              worldOrigin.z,
            );
          }
          if (beamState.localDirection) {
            const worldDirection = TEMP_DIR.copy(beamState.localDirection)
              .applyQuaternion(source.transform.rotation)
              .normalize();
            projectile.direction.copy(worldDirection);
            projectile.transform.rotation.setFromUnitVectors(FORWARD, worldDirection);
          }
        }
      }
      continue;
    }

    const move = component.speed * delta;
    const direction = projectile.direction;
    const current = projectile.transform.position;
    const next = TEMP_POS.copy(current).addScaledVector(direction, move);
    clampToWorld(next);

    deferSetNextKinematicTranslation(
      state,
      projectile.rigidBody as unknown as KinematicBody,
      next.x,
      next.y,
      next.z,
    );
  }
}

export function fireProjectile(
  state: GameState,
  origin: ShipEntity,
  direction: Vector3,
  opts?: {
    originPosition?: Vector3;
    override?: Partial<
      Pick<ShipEntity['ship'], 'damage' | 'projectileSpeed' | 'range' | 'bulletType' | 'damageType'>
    >;
    targetId?: number;
    projectileCategory?: ProjectileCategory;
  },
): void {
  const muzzleOffset = origin.transform.scale * 1.6;
  const startPosition = opts?.originPosition
    ? opts.originPosition.clone()
    : origin.transform.position.clone().addScaledVector(direction, muzzleOffset);
  const rotation = new Quaternion().setFromUnitVectors(FORWARD, direction);

  const bulletKey = opts?.override?.bulletType ?? origin.ship.bulletType ?? '';
  const cfg = PROJECTILE_CONFIG[bulletKey] ?? DEFAULT_PROJECTILE_CONFIG;
  const category = opts?.projectileCategory ?? cfg.category ?? getProjectileCategory(bulletKey);
  const visualScale = cfg.visualScale ?? DEFAULT_PROJECTILE_CONFIG.visualScale;
  const colliderRadius = cfg.colliderRadius ?? Math.max(0.08, visualScale * 1.2);

  const speedOverrides = opts?.override?.projectileSpeed;
  let speed = speedOverrides ?? origin.ship.projectileSpeed;
  if (category === 'beam') {
    speed = 0;
  }
  if (AI_CONFIG.rangePolicy === 'v0.1.1-exp' && !speedOverrides) {
    if (origin.ship.hull === 'destroyer' || origin.ship.hull === 'carrier') {
      speed *= 1.05;
    } else if (origin.ship.hull === 'fighter') {
      speed *= 1.02;
    } else if (origin.ship.hull === 'corvette') {
      speed *= 0.98;
    } else if (origin.ship.hull === 'frigate') {
      speed *= 0.96;
    }

    const speedAdjustments: Record<string, number> = {
      'bullet:laser': 0.97,
      'bullet:heavy': 1.03,
      'bullet:ion': 1.03,
    };
    const adjustment = speedAdjustments[bulletKey];
    if (adjustment != null) {
      speed *= adjustment;
    }
  }
  const damageType = opts?.override?.damageType ?? origin.ship.damageType;
  const damage =
    (opts?.override?.damage ?? origin.ship.damage) *
    getEffectiveStats(origin.ship).damageMultiplier;
  const range = opts?.override?.range ?? origin.ship.range;
  const beamConfig = category === 'beam' ? getProjectileBeamConfig(bulletKey) : undefined;
  const lifetime =
    category === 'beam'
      ? Math.min(beamConfig?.ttl ?? 0.1, 0.5)
      : Math.min(range / Math.max(1e-3, speed), 30);

  let beamState: BeamRuntimeState | undefined;
  if (beamConfig) {
    beamState = {
      ttl: beamConfig.ttl,
      width: beamConfig.width,
      length: beamConfig.length,
      maxLength: beamConfig.length,
    };

    const shipRotation = origin.transform.rotation;
    const invRotation =
      typeof (shipRotation as Quaternion).clone === 'function'
        ? (shipRotation as Quaternion).clone().invert()
        : new Quaternion(
            (shipRotation as Quaternion).x ?? 0,
            (shipRotation as Quaternion).y ?? 0,
            (shipRotation as Quaternion).z ?? 0,
            (shipRotation as Quaternion).w ?? 1,
          ).invert();
    const localOrigin = startPosition
      .clone()
      .sub(origin.transform.position)
      .applyQuaternion(invRotation);
    const scale = origin.transform.scale;
    if (Math.abs(scale) > 1e-5) {
      localOrigin.divideScalar(scale);
    }
    beamState.localOrigin = localOrigin;

    const localDirection = direction.clone().applyQuaternion(invRotation).normalize();
    beamState.localDirection = localDirection;
  }

  const spawnDirection = direction.clone();
  const rotationComponents = { x: rotation.x, y: rotation.y, z: rotation.z, w: rotation.w };
  const positionComponents = { x: startPosition.x, y: startPosition.y, z: startPosition.z };
  const projectileData = {
    team: origin.ship.team,
    damage,
    ttl: lifetime,
    speed,
    bulletType: opts?.override?.bulletType ?? origin.ship.bulletType,
    damageType,
    sourceId: origin.id,
    category,
    targetId: opts?.targetId,
    homing: cfg.homing,
    armingTime: cfg.armingTime,
    armed: cfg.armingTime ? cfg.armingTime <= 0 : true,
    aoeRadius: cfg.aoeRadius,
    spawnTime: state.time,
    beam: beamState,
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
        category: projectileData.category,
        targetId: projectileData.targetId,
        homing: projectileData.homing,
        armingTime: projectileData.armingTime,
        armed: projectileData.armed,
        aoeRadius: projectileData.aoeRadius,
        spawnTime: projectileData.spawnTime,
        beam: projectileData.beam,
      },
      direction: spawnDirection.clone(),
    });

    if (collider?.handle != null) {
      state.colliderLookup.set(collider.handle, projectile);
    }
  });
}
