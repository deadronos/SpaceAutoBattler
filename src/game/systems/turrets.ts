import { Quaternion, Vector3 } from 'three';
import type { GameState, ShipEntity, TurretEntity, TurretState } from '../../types/index.js';
import { recordShotHelper } from '../metrics.js';
import { fireProjectile, TEMP_POS } from './projectiles.js';
import type { KinematicBody } from '../physics/safeKinematics.js';
import { deferSetNextKinematicTranslation } from '../physics/safeKinematics.js';
import { findNearestEnemy } from '../utils/targetSelection.js';

const TEMP_TURRET_DIR = new Vector3();
const TEMP_QUAT = new Quaternion();
const TEMP_LOCAL_DIR = new Vector3();

// Hull size classification for turret priority targeting
const SMALL_HULLS = new Set(['fighter', 'corvette']);
const LARGE_HULLS = new Set(['frigate', 'destroyer', 'carrier']);

function getTurretWorldPosition(ship: ShipEntity, turret: TurretState): Vector3 {
  const world = TEMP_POS.copy(turret.offset).multiplyScalar(ship.transform.scale);
  world.applyQuaternion(ship.transform.rotation).add(ship.transform.position);
  return world;
}

/**
 * Runs logic for embedded turrets (not separate entities).
 *
 * @param {GameState} state - The game state.
 * @param {ShipEntity} ship - The ship with embedded turrets.
 * @param {ShipEntity} target - The current target.
 */
export function runEmbeddedTurrets(state: GameState, ship: ShipEntity, target: ShipEntity): void {
  for (const turret of ship.turrets ?? []) {
    if (turret.cooldown > 0) continue;
    const turretOrigin = getTurretWorldPosition(ship, turret);
    const toTarget = TEMP_TURRET_DIR.copy(target.transform.position).sub(turretOrigin);
    const dist = toTarget.length();
    if (dist > turret.range) continue;
    if (dist > 1e-5) toTarget.divideScalar(dist);
    else toTarget.set(0, 0, 1);
    recordShotHelper(state, ship, target, dist);
    fireProjectile(state, ship, toTarget, {
      originPosition: turretOrigin,
      override: {
        damage: turret.damage,
        projectileSpeed: turret.projectileSpeed,
        range: turret.range,
        bulletType: turret.bulletType,
        targetId: target.id,
        projectileCategory: turret.projectileCategory,
      },
      targetId: target.id,
    });
    turret.cooldown = turret.fireRate;
  }
}

/**
 * Updates all independent turret entities.
 *
 * @param {GameState} state - The game state.
 * @param {number} delta - The time step.
 */
export function updateTurrets(state: GameState, delta: number): void {
  const turrets = state.queries.turrets.entities as TurretEntity[];
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
    let target: ShipEntity | null = null;
    if (t.turret.priority && t.turret.priority !== 'any') {
      const ships = state.queries.ships.entities as ShipEntity[];
      const preferSmall = t.turret.priority === 'antiFighter';
      let bestScore = Number.POSITIVE_INFINITY;
      let best: ShipEntity | null = null;
      // Avoid filter: iterate directly and skip same-team ships
      for (const s of ships) {
        if (s.ship.team === ship.ship.team) continue;
        const dSq = s.transform.position.distanceToSquared(origin);
        // Bonus scaling: multiply by typical distance magnitude to maintain
        // relative weighting when using squared distances
        const bonusScale = 100000;
        const bonus = preferSmall
          ? SMALL_HULLS.has(s.ship.hull)
            ? -10 * bonusScale
            : LARGE_HULLS.has(s.ship.hull)
              ? +5 * bonusScale
              : 0
          : LARGE_HULLS.has(s.ship.hull)
            ? -10 * bonusScale
            : SMALL_HULLS.has(s.ship.hull)
              ? +5 * bonusScale
              : 0;
        const score = dSq + bonus;
        if (score < bestScore) {
          bestScore = score;
          best = s;
        }
      }
      target = best;
    }

    if (!target) {
      target = findNearestEnemy(state, ship);
    }
    t.turret.cooldown = Math.max(0, t.turret.cooldown - delta);
    if (!target || t.turret.cooldown > 0) continue;
    const toTarget = TEMP_TURRET_DIR.copy(target.transform.position).sub(origin);
    const dist = toTarget.length();
    if (dist > t.turret.range) continue;
    if (dist > 1e-5) toTarget.divideScalar(dist);
    else toTarget.set(0, 0, 1);
    const invRot = TEMP_QUAT.copy(ship.transform.rotation).invert();
    const localDir = TEMP_LOCAL_DIR.copy(toTarget).applyQuaternion(invRot);
    const yaw = Math.atan2(localDir.x, localDir.z);
    const pitch = Math.asin(Math.max(-1, Math.min(1, localDir.y)));
    const minYaw = t.turret.minYaw ?? -Math.PI;
    const maxYaw = t.turret.maxYaw ?? Math.PI;
    const minPitch = t.turret.minPitch ?? -Math.PI / 2;
    const maxPitch = t.turret.maxPitch ?? Math.PI / 2;
    if (yaw < minYaw || yaw > maxYaw || pitch < minPitch || pitch > maxPitch) continue;
    recordShotHelper(state, ship, target, dist);
    fireProjectile(state, ship, toTarget, {
      originPosition: origin,
      override: {
        damage: t.turret.damage,
        projectileSpeed: t.turret.projectileSpeed,
        range: t.turret.range,
        bulletType: t.turret.bulletType,
        targetId: target.id,
        projectileCategory: t.turret.projectileCategory,
      },
      targetId: target.id,
    });
    t.turret.cooldown = t.turret.fireRate;
  }
}
