import { Quaternion, Vector3 } from 'three';
import type {
  GameEntity,
  GameState,
  ProjectileEntity,
  ShipEntity,
  ShieldRipple,
  TurretState,
  TurretEntity
} from '../types/index.js';
import { destroyEntity } from './state.js';
import { clampToWorld } from './config.js';
import { PROJECTILE_CONFIG, DEFAULT_PROJECTILE_CONFIG } from '../config/projectiles.js';

const FORWARD = new Vector3(0, 0, 1);
const TEMP_DIR = new Vector3();
const TEMP_POS = new Vector3();

export function updateGame(state: GameState, delta: number): void {
  state.time += delta;

  prepareShips(state, delta);
  updateTurrets(state, delta);
  advanceProjectiles(state, delta);

  state.physicsWorld.step(state.eventQueue);

  syncTransforms(state);
  resolveProjectiles(state, delta);
}

function prepareShips(state: GameState, delta: number): void {
  const ships = state.queries.ships.entities as ShipEntity[];

  for (const ship of ships) {
    ship.ship.cooldown = Math.max(0, ship.ship.cooldown - delta);
    // Tick turret cooldowns if present
    if (ship.turrets) {
      for (const turret of ship.turrets) turret.cooldown = Math.max(0, turret.cooldown - delta);
    }
    const target = findNearestEnemy(state, ship);

    if (!target) {
      ship.rigidBody.setNextKinematicTranslation({
        x: ship.transform.position.x,
        y: ship.transform.position.y,
        z: ship.transform.position.z
      });
      continue;
    }

    const direction = TEMP_DIR.subVectors(target.transform.position, ship.transform.position);
    const distance = direction.length();
    if (distance > 0.0001) {
      direction.normalize();
    } else {
      direction.set(0, 0, 1);
    }

    orientTowards(ship, direction);

    if (distance > ship.ship.range * 0.6) {
      const moveDistance = Math.min(ship.ship.speed * delta, Math.max(distance - ship.ship.range * 0.55, 0));
      const nextPosition = TEMP_POS
        .copy(ship.transform.position)
        .addScaledVector(direction, moveDistance);
      clampToWorld(nextPosition);

      ship.rigidBody.setNextKinematicTranslation({
        x: nextPosition.x,
        y: nextPosition.y,
        z: nextPosition.z
      });
    } else {
      ship.rigidBody.setNextKinematicTranslation({
        x: ship.transform.position.x,
        y: ship.transform.position.y,
        z: ship.transform.position.z
      });
    }

  if (distance <= ship.ship.range && ship.ship.cooldown <= 0) {
      // Emit a muzzle flash at the ship nose (local forward offset)
      (ship.muzzleFlashes ??= []).push({
        local: new Vector3(0, 0, ship.transform.scale * 1.6),
        t0: state.time,
        amp: 1,
        bulletType: ship.ship.bulletType
      });
      fireProjectile(state, ship, direction);
      ship.ship.cooldown = ship.ship.fireRate;
    }

    // Legacy embedded turret logic: only run if there are no turret entities present
    if ((state.queries.turrets.entities.length === 0) && ship.turrets && target) {
      for (const turret of ship.turrets) {
        if (turret.cooldown > 0) continue;
        // Compute turret world-space origin and direction towards target
        const turretOrigin = getTurretWorldPosition(ship, turret);
        const toTarget = TEMP_DIR.copy(target.transform.position).sub(turretOrigin);
        const dist = toTarget.length();
        if (dist <= turret.range) {
          if (dist > 1e-5) toTarget.divideScalar(dist); else toTarget.set(0, 0, 1);
          // Legacy path: we keep ship-level flashes only when no turret entities are used
          fireProjectile(state, ship, toTarget, {
            originPosition: turretOrigin,
            override: {
              damage: turret.damage,
              projectileSpeed: turret.projectileSpeed,
              range: turret.range,
              bulletType: turret.bulletType
            }
          });
          turret.cooldown = turret.fireRate;
        }
      }
    }

    // Prune old muzzle flashes (lifetime ~0.25s)
    if (ship.muzzleFlashes && ship.muzzleFlashes.length) {
      const life = 0.25;
      ship.muzzleFlashes = ship.muzzleFlashes.filter((m) => state.time - m.t0 < life);
    }
  }
}

function updateTurrets(state: GameState, delta: number): void {
  const turrets = state.queries.turrets.entities as TurretEntity[];
  for (const t of turrets) {
    const ship = t.turret.parent;
    // sync turret transform with parent + local offset
    const origin = getTurretWorldPosition(ship, { offset: t.turret.offset } as TurretState);
    t.rigidBody.setNextKinematicTranslation({ x: origin.x, y: origin.y, z: origin.z });
    // choose target considering priority
    let target = findNearestEnemy(state, ship);
    if (t.turret.priority && t.turret.priority !== 'any') {
      const ships = state.queries.ships.entities as ShipEntity[];
      const candidates = ships.filter(s => s.ship.team !== ship.ship.team);
      const small = new Set(['fighter', 'corvette']);
      const large = new Set(['frigate', 'destroyer', 'carrier']);
      const preferSmall = t.turret.priority === 'antiFighter';
      let bestScore = Number.POSITIVE_INFINITY;
      let best: ShipEntity | null = null;
      for (const s of candidates) {
        const d = s.transform.position.distanceTo(origin);
        const bonus = preferSmall ? (small.has(s.ship.hull) ? -10 : (large.has(s.ship.hull) ? +5 : 0))
                                  : (large.has(s.ship.hull) ? -10 : (small.has(s.ship.hull) ? +5 : 0));
        const score = d + bonus;
        if (score < bestScore) { bestScore = score; best = s; }
      }
      if (best) target = best;
    }
    // cooldown
    t.turret.cooldown = Math.max(0, t.turret.cooldown - delta);
    if (!target || t.turret.cooldown > 0) continue;
    const toTarget = TEMP_DIR.copy(target.transform.position).sub(origin);
    const dist = toTarget.length();
    if (dist > t.turret.range) continue;
    if (dist > 1e-5) toTarget.divideScalar(dist); else toTarget.set(0, 0, 1);
    // Compute direction in parent ship's local frame to derive yaw/pitch
    const invRot = ship.transform.rotation.clone().invert();
    const localDir = toTarget.clone().applyQuaternion(invRot);
    // yaw around Y, pitch around X
    const yaw = Math.atan2(localDir.x, localDir.z);
    const pitch = Math.asin(Math.max(-1, Math.min(1, localDir.y)));
    // clamp to arcs
    const minYaw = t.turret.minYaw ?? -Math.PI;
    const maxYaw = t.turret.maxYaw ?? Math.PI;
    const minPitch = t.turret.minPitch ?? -Math.PI * 0.5;
    const maxPitch = t.turret.maxPitch ?? Math.PI * 0.5;
    const clampedYaw = Math.max(minYaw, Math.min(maxYaw, yaw));
    const clampedPitch = Math.max(minPitch, Math.min(maxPitch, pitch));
    t.turret.yaw = clampedYaw;
    t.turret.pitch = clampedPitch;
    // Only fire if the unclamped yaw/pitch are within limits (i.e., we can aim at target)
    const withinArc = yaw === clampedYaw && pitch === clampedPitch;
    // set turret rotation to parent rotation * yaw * pitch
    const yawQ = new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), clampedYaw);
    const pitchQ = new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), clampedPitch);
    const turretRot = ship.transform.rotation.clone().multiply(yawQ).multiply(pitchQ);
    t.rigidBody.setNextKinematicRotation({ x: turretRot.x, y: turretRot.y, z: turretRot.z, w: turretRot.w });
    if (!withinArc) continue;
    // prune old flashes, then add a new one (local forward of turret group)
    if (t.muzzleFlashes && t.muzzleFlashes.length) {
      const life = 0.25;
      t.muzzleFlashes = t.muzzleFlashes.filter(m => state.time - m.t0 < life);
    }
    (t.muzzleFlashes ??= []).push({ local: new Vector3(0, 0, 0.2), t0: state.time, amp: 0.9, bulletType: t.turret.bulletType });
    // fire
    fireProjectile(state, ship, toTarget, {
      originPosition: origin,
      override: {
        damage: t.turret.damage,
        projectileSpeed: t.turret.projectileSpeed,
        range: t.turret.range,
        bulletType: t.turret.bulletType
      }
    });
    t.turret.cooldown = t.turret.fireRate;
  }
}

function advanceProjectiles(state: GameState, delta: number): void {
  const projectiles = state.queries.projectiles.entities as ProjectileEntity[];
  for (const projectile of projectiles) {
    const move = projectile.projectile.speed * delta;
    const direction = projectile.direction;
    const current = projectile.transform.position;
    const next = TEMP_POS.copy(current).addScaledVector(direction, move);
    clampToWorld(next);

    projectile.rigidBody.setNextKinematicTranslation({ x: next.x, y: next.y, z: next.z });
  }
}

function syncTransforms(state: GameState): void {
  for (const entity of state.world.entities as GameEntity[]) {
    const translation = entity.rigidBody.translation();
    const rotation = entity.rigidBody.rotation();

    entity.transform.position.set(translation.x, translation.y, translation.z);
    entity.transform.rotation.set(rotation.x, rotation.y, rotation.z, rotation.w);
  }
}

function resolveProjectiles(state: GameState, delta: number): void {
  const ships = state.queries.ships.entities as ShipEntity[];
  const projectiles = state.queries.projectiles.entities as ProjectileEntity[];
  const toRemove = new Set<GameEntity>();

  for (const projectile of projectiles) {
    projectile.projectile.ttl -= delta;
    if (projectile.projectile.ttl <= 0) {
      toRemove.add(projectile);
      continue;
    }

    for (const ship of ships) {
      if (ship.ship.team === projectile.projectile.team) continue;
      const distance = ship.transform.position.distanceTo(projectile.transform.position);
      const impactRadius = ship.transform.scale * 0.9;
      if (distance > impactRadius) continue;
      // Apply damage to shields first, then to hull.
      let remaining = projectile.projectile.damage;
      if (ship.ship.shield > 0) {
        const absorbed = Math.min(ship.ship.shield, remaining);
        ship.ship.shield -= absorbed;
        remaining -= absorbed;
        // Emit a shield ripple event oriented from impact direction.
        const dir = TEMP_DIR.copy(projectile.transform.position).sub(ship.transform.position);
        if (dir.lengthSq() > 1e-5) dir.normalize(); else dir.set(0, 0, 1);
        const strength = Math.min(1, absorbed / Math.max(1, ship.ship.maxShield));
  const ripple: ShieldRipple = { dir: dir.clone(), t0: state.time, amp: strength };
        (ship.shieldRipples ??= []).push(ripple);
        // Keep only a few recent ripples for rendering.
        if (ship.shieldRipples.length > 6) ship.shieldRipples.shift();
      }

      if (remaining > 0) {
        ship.ship.hp -= remaining;
      }
      toRemove.add(projectile);

      if (ship.ship.hp <= 0) {
        toRemove.add(ship);
      }
      break;
    }
  }

  for (const entity of toRemove) {
    destroyEntity(state, entity);
  }
}

function orientTowards(ship: ShipEntity, direction: Vector3): void {
  const rotation = new Quaternion().setFromUnitVectors(FORWARD, direction);
  const bank = Math.max(Math.min(direction.x * 0.6, 0.6), -0.6);
  const banking = new Quaternion().setFromAxisAngle(FORWARD, -bank);
  rotation.multiply(banking);

  ship.transform.rotation.copy(rotation);
  ship.rigidBody.setNextKinematicRotation({ x: rotation.x, y: rotation.y, z: rotation.z, w: rotation.w });
}

export function fireProjectile(
  state: GameState,
  origin: ShipEntity,
  direction: Vector3,
  opts?: {
    /** If provided, use this exact world position as muzzle; otherwise use ship nose offset. */
    originPosition?: Vector3;
    /** Override projectile stats (used by turrets). */
    override?: Partial<Pick<ShipEntity['ship'], 'damage' | 'projectileSpeed' | 'range' | 'bulletType'>>;
  }
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

  // Choose visual/physics size based on bullet type configuration
  const bulletKey = (opts?.override?.bulletType ?? origin.ship.bulletType) ?? '';
  const cfg = PROJECTILE_CONFIG[bulletKey] ?? DEFAULT_PROJECTILE_CONFIG;
  const visualScale = cfg.visualScale ?? DEFAULT_PROJECTILE_CONFIG.visualScale;
  const colliderRadius = cfg.colliderRadius ?? Math.max(0.08, visualScale * 1.2);

  const colliderDesc = state.rapier.ColliderDesc.ball(colliderRadius)
    .setActiveEvents(state.rapier.ActiveEvents.COLLISION_EVENTS)
    .setActiveCollisionTypes(state.rapier.ActiveCollisionTypes.ALL);
  const collider = state.physicsWorld.createCollider(colliderDesc, body);

  const speed = opts?.override?.projectileSpeed ?? origin.ship.projectileSpeed;
  const damage = opts?.override?.damage ?? origin.ship.damage;
  const range = opts?.override?.range ?? origin.ship.range;
  const lifetime = Math.min(range / speed, 4);

  const projectile = state.world.createEntity({
    id: state.nextEntityId++,
    rigidBody: body,
    collider,
    transform: {
      position: startPosition,
      rotation,
      scale: visualScale
    },
    projectile: {
      team: origin.ship.team,
      damage,
      ttl: lifetime,
      maxTtl: lifetime,
      speed,
      bulletType: opts?.override?.bulletType ?? origin.ship.bulletType
    },
    direction: direction.clone()
  }) as ProjectileEntity;

  state.colliderLookup.set(collider.handle, projectile);
}

export function findNearestEnemy(state: GameState, origin: ShipEntity): ShipEntity | null {
  const ships = state.queries.ships.entities as ShipEntity[];
  let closest: ShipEntity | null = null;
  let shortest = Number.POSITIVE_INFINITY;

  for (const ship of ships) {
    if (ship === origin) continue;
    if (ship.ship.team === origin.ship.team) continue;
    const distance = origin.transform.position.distanceTo(ship.transform.position);
    if (distance < shortest) {
      shortest = distance;
      closest = ship;
    }
  }

  return closest;
}

// Compute turret origin in world space from ship transform and local turret offset
function getTurretWorldPosition(ship: ShipEntity, turret: TurretState): Vector3 {
  const world = TEMP_POS.copy(turret.offset).multiplyScalar(ship.transform.scale);
  // rotate by ship rotation, then add ship position
  world.applyQuaternion(ship.transform.rotation).add(ship.transform.position);
  return world;
}
