import { Vector3 } from 'three';
import type {
  GameState,
  ProjectileEntity,
  ShipEntity,
  TurretEntity,
  TurretState,
} from '../../types/index.js';
import { recordShotMetrics } from '../metrics.js';
import { fireProjectile, TEMP_DIR, TEMP_POS } from './projectiles.js';
import type { KinematicBody } from '../physics/safeKinematics.js';
import { deferSetNextKinematicTranslation } from '../physics/safeKinematics.js';

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
  const turrets = ship.turrets ?? [];
  for (let turretIndex = 0; turretIndex < turrets.length; turretIndex += 1) {
    const turret = turrets[turretIndex];
    if (turret.cooldown > 0) continue;
    const turretOrigin = getTurretWorldPosition(ship, turret);
    const toTarget = TEMP_DIR.copy(target.transform.position).sub(turretOrigin);
    const dist = toTarget.length();
    if (dist > turret.range) continue;
    if (dist > 1e-5) toTarget.divideScalar(dist);
    else toTarget.set(0, 0, 1);
    if (turret.aimDirection) turret.aimDirection.copy(toTarget);
    else turret.aimDirection = toTarget.clone();
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
    const overrideDamageType =
      turret.projectileCategory === 'torpedo' || turret.projectileCategory === 'missile'
        ? 'explosive'
        : turret.projectileCategory === 'beam'
          ? 'ion'
          : ship.ship.damageType;
    fireProjectile(state, ship, toTarget, {
      originPosition: turretOrigin,
      override: {
        damage: turret.damage,
        projectileSpeed: turret.projectileSpeed,
        range: turret.range,
        bulletType: turret.bulletType,
        damageType: overrideDamageType,
      },
      projectileCategory: turret.projectileCategory,
      targetId: target.id,
      sourceTurretIndex: turretIndex,
    });
    turret.cooldown = turret.fireRate;
  }
}

export function updateTurrets(state: GameState, delta: number): void {
  const turrets = state.queries.turrets.entities as TurretEntity[];
  const projectiles = state.queries.projectiles.entities as ProjectileEntity[];
  for (const t of turrets) {
    const ship = t.turret.parent;
    const origin = getTurretWorldPosition(ship, { offset: t.turret.offset } as TurretState);
    deferSetNextKinematicTranslation(
      state,
      t.rigidBody as unknown as KinematicBody,
      origin.x,
      origin.y,
      origin.z,
    );
    t.transform.position.copy(origin);
    let pdTarget: ProjectileEntity | null = null;
    if (t.turret.pointDefense) {
      const pdRange = t.turret.pointDefenseRange ?? t.turret.range;
      let bestDistance = pdRange;
      for (const projectile of projectiles) {
        if (projectile.projectile.team === ship.ship.team) continue;
        if (
          projectile.projectile.category !== 'missile' &&
          projectile.projectile.category !== 'torpedo'
        )
          continue;
        const distance = projectile.transform.position.distanceTo(origin);
        if (distance > pdRange) continue;
        if (distance < bestDistance) {
          bestDistance = distance;
          pdTarget = projectile;
        }
      }
    }
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

    if (pdTarget && t.turret.cooldown <= 0) {
      const pdRange = t.turret.pointDefenseRange ?? t.turret.range;
      const toProjectile = TEMP_DIR.copy(pdTarget.transform.position).sub(origin);
      const distPd = toProjectile.length();
      if (distPd <= pdRange) {
        if (distPd > 1e-5) toProjectile.divideScalar(distPd);
        else toProjectile.set(0, 0, 1);
        const invRot = ship.transform.rotation.clone().invert();
        const localDir = toProjectile.clone().applyQuaternion(invRot);
        const yaw = Math.atan2(localDir.x, localDir.z);
        const pitch = Math.asin(Math.max(-1, Math.min(1, localDir.y)));
        const minYaw = t.turret.minYaw ?? -Math.PI;
        const maxYaw = t.turret.maxYaw ?? Math.PI;
        const minPitch = t.turret.minPitch ?? -Math.PI / 2;
        const maxPitch = t.turret.maxPitch ?? Math.PI / 2;
        if (yaw >= minYaw && yaw <= maxYaw && pitch >= minPitch && pitch <= maxPitch) {
          const aimDir = t.turret.aimDirection ?? (t.turret.aimDirection = new Vector3(0, 0, 1));
          aimDir.copy(toProjectile);
          const entityDir = t.direction ?? (t.direction = new Vector3(0, 0, 1));
          entityDir.copy(toProjectile);
          const overrideDamageType =
            t.turret.projectileCategory === 'torpedo' || t.turret.projectileCategory === 'missile'
              ? 'explosive'
              : t.turret.projectileCategory === 'beam'
                ? 'ion'
                : ship.ship.damageType;
          fireProjectile(state, ship, toProjectile, {
            originPosition: origin,
            override: {
              damage: t.turret.damage,
              projectileSpeed: t.turret.projectileSpeed,
              range: pdRange,
              bulletType: t.turret.bulletType,
              damageType: overrideDamageType,
            },
            projectileCategory: t.turret.projectileCategory,
            sourceTurretId: t.id,
          });
          t.turret.cooldown = t.turret.fireRate;
          continue;
        }
      }
    }

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
    const overrideDamageType =
      t.turret.projectileCategory === 'torpedo' || t.turret.projectileCategory === 'missile'
        ? 'explosive'
        : t.turret.projectileCategory === 'beam'
          ? 'ion'
          : ship.ship.damageType;
    const aimDir = t.turret.aimDirection ?? (t.turret.aimDirection = new Vector3(0, 0, 1));
    aimDir.copy(toTarget);
    const entityDir = t.direction ?? (t.direction = new Vector3(0, 0, 1));
    entityDir.copy(toTarget);
    fireProjectile(state, ship, toTarget, {
      originPosition: origin,
      override: {
        damage: t.turret.damage,
        projectileSpeed: t.turret.projectileSpeed,
        range: t.turret.range,
        bulletType: t.turret.bulletType,
        damageType: overrideDamageType,
      },
      projectileCategory: t.turret.projectileCategory,
      targetId: target.id,
      sourceTurretId: t.id,
    });
    t.turret.cooldown = t.turret.fireRate;
  }
}
