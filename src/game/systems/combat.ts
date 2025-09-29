import { Quaternion, Vector3 } from 'three';
import type {
  GameEntity,
  GameState,
  ProjectileEntity,
  ShipEntity,
  ShieldRipple,
  TurretEntity,
  TurretState,
} from '../../types/index.js';
import { clampToWorld } from '../config.js';
import { PROJECTILE_CONFIG, DEFAULT_PROJECTILE_CONFIG } from '../../config/projectiles.js';
import {
  applySubsystemDamage,
  awardDamageXp,
  awardKillXp,
  calculateEffectiveDamage,
  getEffectiveStats,
} from '../progression.js';
import { emitShipKillExplosion } from '../explosions.js';
import { destroyEntity } from '../state.js';
import { AI_CONFIG } from '../config.js';
import { SeededRng } from '../../utils/rng.js';
import { recordShotMetrics } from '../metrics.js';
import {
  accumulateInterruptDamage,
  ensureInterruptState,
  getInterruptQueue,
  queueInterrupt,
  queueTargetLossInterrupts,
} from './decision/interrupts.js';

const FORWARD = new Vector3(0, 0, 1);
const TEMP_DIR = new Vector3();
const TEMP_POS = new Vector3();

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

function getTurretWorldPosition(ship: ShipEntity, turret: TurretState): Vector3 {
  const world = TEMP_POS.copy(turret.offset).multiplyScalar(ship.transform.scale);
  world.applyQuaternion(ship.transform.rotation).add(ship.transform.position);
  return world;
}

export function runEmbeddedTurrets(state: GameState, ship: ShipEntity, target: ShipEntity): void {
  for (const turret of ship.turrets ?? []) {
    if (turret.cooldown > 0) continue;
    const turretOrigin = getTurretWorldPosition(ship, turret);
    const toTarget = TEMP_DIR.copy(target.transform.position).sub(turretOrigin);
    const dist = toTarget.length();
    if (dist > turret.range) continue;
    if (dist > 1e-5) toTarget.divideScalar(dist);
    else toTarget.set(0, 0, 1);
    const metrics = state.ai?.metrics;
    if (metrics) {
      recordShotMetrics(metrics, {
        shipId: ship.id,
        hull: ship.ship.hull,
        time: state.time,
        distance: dist,
        deltaY: target.transform.position.y - ship.transform.position.y,
      });
    }
    fireProjectile(state, ship, toTarget, {
      originPosition: turretOrigin,
      override: {
        damage: turret.damage,
        projectileSpeed: turret.projectileSpeed,
        range: turret.range,
        bulletType: turret.bulletType,
      },
    });
    turret.cooldown = turret.fireRate;
  }
}

export function updateTurrets(state: GameState, delta: number): void {
  const turrets = state.queries.turrets.entities as TurretEntity[];
  for (const t of turrets) {
    const ship = t.turret.parent;
    const origin = getTurretWorldPosition(ship, { offset: t.turret.offset } as TurretState);
    t.rigidBody.setNextKinematicTranslation({ x: origin.x, y: origin.y, z: origin.z });
    let target = findNearestEnemy(state, ship);
    if (t.turret.priority && t.turret.priority !== 'any') {
      const ships = state.queries.ships.entities as ShipEntity[];
      const candidates = ships.filter((s) => s.ship.team !== ship.ship.team);
      const small = new Set(['fighter', 'corvette']);
      const large = new Set(['frigate', 'destroyer', 'carrier']);
      const preferSmall = t.turret.priority === 'antiFighter';
      let bestScore = Number.POSITIVE_INFINITY;
      let best: ShipEntity | null = null;
      for (const s of candidates) {
        const d = s.transform.position.distanceTo(origin);
        const bonus = preferSmall
          ? small.has(s.ship.hull)
            ? -10
            : large.has(s.ship.hull)
              ? +5
              : 0
          : large.has(s.ship.hull)
            ? -10
            : small.has(s.ship.hull)
              ? +5
              : 0;
        const score = d + bonus;
        if (score < bestScore) {
          bestScore = score;
          best = s;
        }
      }
      if (best) target = best;
    }
    t.turret.cooldown = Math.max(0, t.turret.cooldown - delta);
    if (!target || t.turret.cooldown > 0) continue;
    const toTarget = TEMP_DIR.copy(target.transform.position).sub(origin);
    const dist = toTarget.length();
    if (dist > t.turret.range) continue;
    if (dist > 1e-5) toTarget.divideScalar(dist);
    else toTarget.set(0, 0, 1);
    const invRot = ship.transform.rotation.clone().invert();
    const localDir = toTarget.clone().applyQuaternion(invRot);
    const yaw = Math.atan2(localDir.x, localDir.z);
    const pitch = Math.asin(Math.max(-1, Math.min(1, localDir.y)));
    const minYaw = t.turret.minYaw ?? -Math.PI;
    const maxYaw = t.turret.maxYaw ?? Math.PI;
    const minPitch = t.turret.minPitch ?? -Math.PI / 2;
    const maxPitch = t.turret.maxPitch ?? Math.PI / 2;
    if (yaw < minYaw || yaw > maxYaw || pitch < minPitch || pitch > maxPitch) continue;
    const metrics = state.ai?.metrics;
    if (metrics) {
      recordShotMetrics(metrics, {
        shipId: ship.id,
        hull: ship.ship.hull,
        time: state.time,
        distance: dist,
        deltaY: target.transform.position.y - ship.transform.position.y,
      });
    }
    fireProjectile(state, ship, toTarget, {
      originPosition: origin,
      override: {
        damage: t.turret.damage,
        projectileSpeed: t.turret.projectileSpeed,
        range: t.turret.range,
        bulletType: t.turret.bulletType,
      },
    });
    t.turret.cooldown = t.turret.fireRate;
  }
}

export function advanceProjectiles(state: GameState, delta: number): void {
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

export function syncTransforms(state: GameState): void {
  for (const entity of state.world.entities as GameEntity[]) {
    const translation = entity.rigidBody.translation();
    const rotation = entity.rigidBody.rotation();

    entity.transform.position.set(translation.x, translation.y, translation.z);
    entity.transform.rotation.set(rotation.x, rotation.y, rotation.z, rotation.w);
  }
}

export function resolveProjectiles(state: GameState, delta: number): void {
  const ships = state.queries.ships.entities as ShipEntity[];
  const projectiles = state.queries.projectiles.entities as ProjectileEntity[];
  const toRemove = new Set<GameEntity>();
  const manager = state.ai;
  if (manager) {
    ensureInterruptState(manager);
    getInterruptQueue(manager);
  }

  for (const projectile of projectiles) {
    projectile.projectile.ttl -= delta;
    if (projectile.projectile.ttl <= 0) {
      toRemove.add(projectile);
      continue;
    }

    for (const ship of ships) {
      if (ship.ship.team === projectile.projectile.team) continue;
      const distance = ship.transform.position.distanceTo(projectile.transform.position);
      const projCfg = PROJECTILE_CONFIG[projectile.projectile.bulletType ?? ''] ?? DEFAULT_PROJECTILE_CONFIG;
      const projRadius = projCfg.colliderRadius ?? Math.max(0.08, projectile.transform.scale * 1.2);
      const impactRadius = ship.transform.scale * 0.9 + projRadius;
      if (distance > impactRadius) continue;

      const damageResult = calculateEffectiveDamage(
        projectile.projectile.damage,
        projectile.projectile.damageType,
        ship.ship.shield,
        ship.ship.armor,
      );

      if (damageResult.shieldDamage > 0) {
        ship.ship.shield -= damageResult.shieldDamage;
        const dir = TEMP_DIR.copy(projectile.transform.position).sub(ship.transform.position);
        if (dir.lengthSq() > 1e-5) dir.normalize();
        else dir.set(0, 0, 1);
        const strength = Math.min(1, damageResult.shieldDamage / Math.max(1, ship.ship.maxShield));
        const ripple: ShieldRipple = { dir: dir.clone(), t0: state.time, amp: strength };
        const list = (ship.shieldRipples ??= []);
        list.push(ripple);
        if (list.length > 64) list.shift();
      }

      if (damageResult.armorDamage > 0) {
        ship.ship.armor = Math.max(0, ship.ship.armor - damageResult.armorDamage * 0.1);
      }

      let hullDamage = 0;
      if (damageResult.hullDamage > 0) {
        const prevHp = ship.ship.hp;
        ship.ship.hp -= damageResult.hullDamage;
        hullDamage = Math.max(0, prevHp - ship.ship.hp);
        applySubsystemDamage(ship.ship, hullDamage, new SeededRng(projectile.id + state.time));
      }

      toRemove.add(projectile);

      const totalDamageDealt = damageResult.shieldDamage + damageResult.armorDamage + damageResult.hullDamage;
      if (totalDamageDealt > 0) {
        const attackerShip = ships.find((s) => s.ship.team === projectile.projectile.team);
        if (attackerShip) {
          awardDamageXp(attackerShip.ship, totalDamageDealt, state, attackerShip.id);
        }
      }

      if (manager && hullDamage > 0) {
        const totalDamage = accumulateInterruptDamage(manager, ship.id, hullDamage, manager.tickIndex);
        const maxHp = Math.max(1, ship.ship.maxHp);
        if (totalDamage / maxHp >= (AI_CONFIG.interruptHpDrop ?? 0.1)) {
          queueInterrupt(manager, {
            shipId: ship.id,
            reason: 'hp-drop',
            tick: manager.tickIndex,
            sourceId: projectile.id,
          });
        }
      }

      if (ship.ship.hp <= 0) {
        if (manager) {
          queueTargetLossInterrupts(state, ships, ship.id);
        }

        const killerShip = ships.find((s) => s.ship.team === projectile.projectile.team);
        if (killerShip) {
          awardKillXp(killerShip.ship, ship.ship.maxHp, state, killerShip.id);
        }

        emitShipKillExplosion(state, ship, projectile);
        toRemove.add(ship);
      }
      break;
    }
  }

  for (const entity of toRemove) {
    destroyEntity(state, entity);
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
  }) as ProjectileEntity;

  state.colliderLookup.set(collider.handle, projectile);
}
