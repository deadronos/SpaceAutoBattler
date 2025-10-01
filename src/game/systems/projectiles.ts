import { Quaternion, Vector3 } from 'three';
import type { GameState, ShipEntity, ProjectileEntity } from '../../types/index.js';
import { clampToWorld, AI_CONFIG } from '../config.js';
import { PROJECTILE_CONFIG, DEFAULT_PROJECTILE_CONFIG } from '../../config/projectiles.js';
import { getEffectiveStats } from '../progression.js';
import { enqueueDeferredMutation } from '../simulationQueue.js';
import type { KinematicBody } from '../physics/safeKinematics.js';
import { deferSetNextKinematicTranslation } from '../physics/safeKinematics.js';

export const FORWARD = new Vector3(0, 0, 1);
export const TEMP_DIR = new Vector3();
export const TEMP_POS = new Vector3();

export function advanceProjectiles(state: GameState, delta: number): void {
  const projectiles = state.queries.projectiles.entities as ProjectileEntity[];
  for (const projectile of projectiles) {
    const move = projectile.projectile.speed * delta;
    const direction = projectile.direction;
    const current = projectile.transform.position;
    const next = TEMP_POS.copy(current).addScaledVector(direction, move);
    clampToWorld(next);

    deferSetNextKinematicTranslation(state, projectile.rigidBody as unknown as KinematicBody, next.x, next.y, next.z);
  }
}

export function fireProjectile(
  state: GameState,
  origin: ShipEntity,
  direction: Vector3,
  opts?: {
    originPosition?: Vector3;
    override?: Partial<Pick<ShipEntity['ship'], 'damage' | 'projectileSpeed' | 'range' | 'bulletType'>>;
  },
): void {
  const muzzleOffset = origin.transform.scale * 1.6;
  const startPosition = opts?.originPosition
    ? opts.originPosition.clone()
    : origin.transform.position.clone().addScaledVector(direction, muzzleOffset);
  const rotation = new Quaternion().setFromUnitVectors(FORWARD, direction);

  const bulletKey = opts?.override?.bulletType ?? origin.ship.bulletType ?? '';
  const cfg = PROJECTILE_CONFIG[bulletKey] ?? DEFAULT_PROJECTILE_CONFIG;
  const visualScale = cfg.visualScale ?? DEFAULT_PROJECTILE_CONFIG.visualScale;
  const colliderRadius = cfg.colliderRadius ?? Math.max(0.08, visualScale * 1.2);

  let speed = opts?.override?.projectileSpeed ?? origin.ship.projectileSpeed;
  if (AI_CONFIG.rangePolicy === 'v0.1.1-exp' && !opts?.override) {
    if (origin.ship.hull === 'destroyer' || origin.ship.hull === 'carrier') {
      speed *= 1.05;
    } else if (origin.ship.hull === 'fighter') {
      speed *= 1.02;
    } else if (origin.ship.hull === 'corvette') {
      speed *= 0.98;
    } else if (origin.ship.hull === 'frigate') {
      speed *= 0.96;
    }

    const bulletType = origin.ship.bulletType ?? '';
    if (bulletType.includes('laser')) {
      speed *= 0.97;
    } else if (bulletType.includes('heavy') || bulletType.includes('ion')) {
      speed *= 1.03;
    }
  }
  const damage = (opts?.override?.damage ?? origin.ship.damage) * getEffectiveStats(origin.ship).damageMultiplier;
  const range = opts?.override?.range ?? origin.ship.range;
  const lifetime = Math.min(range / speed, 30);

  const spawnDirection = direction.clone();
  const rotationComponents = { x: rotation.x, y: rotation.y, z: rotation.z, w: rotation.w };
  const positionComponents = { x: startPosition.x, y: startPosition.y, z: startPosition.z };
  const projectileData = {
    team: origin.ship.team,
    damage,
    ttl: lifetime,
    speed,
    bulletType: opts?.override?.bulletType ?? origin.ship.bulletType,
    damageType: origin.ship.damageType,
    sourceId: origin.id,
  };

  enqueueDeferredMutation(state, () => {
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
        rotation: new Quaternion(rotationComponents.x, rotationComponents.y, rotationComponents.z, rotationComponents.w),
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

    if (collider?.handle != null) {
      state.colliderLookup.set(collider.handle, projectile);
    }
  });
}
