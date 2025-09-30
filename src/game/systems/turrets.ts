import { Vector3 } from 'three';
import type { GameState, ShipEntity, TurretEntity, TurretState } from '../../types/index.js';
import { recordShotMetrics } from '../metrics.js';
import { fireProjectile, TEMP_DIR, TEMP_POS } from './projectiles.js';

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
