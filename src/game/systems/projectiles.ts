import { Quaternion, Vector3 } from 'three';
import type { GameState, ShipEntity } from '../../types/index.js';
import { clampToWorld, AI_CONFIG } from '../config.js';
import { PROJECTILE_CONFIG, DEFAULT_PROJECTILE_CONFIG } from '../../config/projectiles.js';
import { getEffectiveStats } from '../progression.js';

export const FORWARD = new Vector3(0, 0, 1);
export const TEMP_DIR = new Vector3();
export const TEMP_POS = new Vector3();

export function advanceProjectiles(state: GameState, delta: number): void {
  const projectiles = state.queries.projectiles.entities as any[];
  for (const projectile of projectiles) {
    const move = projectile.projectile.speed * delta;
    const direction = projectile.direction;
    const current = projectile.transform.position;
    const next = TEMP_POS.copy(current).addScaledVector(direction, move);
    clampToWorld(next);

    projectile.rigidBody.setNextKinematicTranslation({ x: next.x, y: next.y, z: next.z });
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

  const bodyDesc = state.rapier.RigidBodyDesc.kinematicPositionBased()
    .setTranslation(startPosition.x, startPosition.y, startPosition.z)
    .setRotation({ x: rotation.x, y: rotation.y, z: rotation.z, w: rotation.w });
  const body = state.physicsWorld.createRigidBody(bodyDesc);

  const bulletKey = opts?.override?.bulletType ?? origin.ship.bulletType ?? '';
  const cfg = PROJECTILE_CONFIG[bulletKey] ?? DEFAULT_PROJECTILE_CONFIG;
  const visualScale = cfg.visualScale ?? DEFAULT_PROJECTILE_CONFIG.visualScale;
  const colliderRadius = cfg.colliderRadius ?? Math.max(0.08, visualScale * 1.2);

  const colliderDesc = state.rapier.ColliderDesc.ball(colliderRadius)
    .setActiveEvents(state.rapier.ActiveEvents.COLLISION_EVENTS)
    .setActiveCollisionTypes(state.rapier.ActiveCollisionTypes.ALL);
  const collider = state.physicsWorld.createCollider(colliderDesc, body);

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

  const projectile = state.world.add({
    id: state.nextEntityId++,
    rigidBody: body,
    collider,
    transform: {
      position: startPosition,
      rotation,
      scale: visualScale,
    },
    projectile: {
      team: origin.ship.team,
      damage,
      ttl: lifetime,
      maxTtl: lifetime,
      speed,
      bulletType: opts?.override?.bulletType ?? origin.ship.bulletType,
      damageType: origin.ship.damageType,
    },
    direction: direction.clone(),
  });

  state.colliderLookup.set(collider.handle, projectile);
}
