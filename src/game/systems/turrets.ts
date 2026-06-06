import { Vector3 } from 'three';
import type {
  GameState,
  ProjectileEntity,
  ShipEntity,
  TurretEntity,
  TurretSpec,
} from '../../types/index.js';
import { recordShotHelper } from '../metrics.js';
import { fireProjectile, TEMP_POS } from './projectiles.js';
import { destroyEntity } from '../state.js';
import type { KinematicBody } from '../physics/safeKinematics.js';
import { deferSetNextKinematicTranslation } from '../physics/safeKinematics.js';
import { findNearestEnemy, findPointDefenseTarget } from '../utils/targetSelection.js';
import {
  TEMP_TURRET_DIR,
  TEMP_QUAT as TURRET_TEMP_QUAT,
  TEMP_LOCAL_DIR,
} from '../../utils/tempVectors.js';

// Hull size classification for turret priority targeting
const SMALL_HULLS = new Set(['fighter', 'corvette']);
const LARGE_HULLS = new Set(['frigate', 'destroyer', 'carrier']);

function getTurretWorldPosition(ship: ShipEntity, turret: TurretSpec): Vector3 {
  const world = TEMP_POS.copy(turret.offset).multiplyScalar(ship.transform.scale);
  world.applyQuaternion(ship.transform.rotation).add(ship.transform.position);
  return world;
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
    const origin = getTurretWorldPosition(ship, t.turret);
    deferSetNextKinematicTranslation(
      state,
      t.rigidBody as unknown as KinematicBody,
      origin.x,
      origin.y,
      origin.z,
    );

    t.turret.cooldown = Math.max(0, t.turret.cooldown - delta);
    if (t.turret.cooldown > 0) continue;

    let target: ShipEntity | null = null;
    let projectileTarget: ProjectileEntity | null = null;
    if (t.turret.priority === 'antiProjectile') {
      projectileTarget = findPointDefenseTarget(state, {
        origin,
        team: ship.ship.team,
        maxRange: t.turret.range,
        preferTargetId: ship.id,
      });
    }

    if (!projectileTarget && t.turret.priority && t.turret.priority !== 'any') {
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

    if (!projectileTarget && !target) {
      target = findNearestEnemy(state, ship);
    }
    if (!projectileTarget && !target) continue;
    const targetPos = projectileTarget
      ? projectileTarget.transform.position
      : target!.transform.position;
    const toTarget = TEMP_TURRET_DIR.copy(targetPos).sub(origin);
    const dist = toTarget.length();
    if (dist > t.turret.range) continue;
    if (dist > 1e-5) toTarget.divideScalar(dist);
    else toTarget.set(0, 0, 1);
    const invRot = TURRET_TEMP_QUAT.copy(ship.transform.rotation).invert();
    const localDir = TEMP_LOCAL_DIR.copy(toTarget).applyQuaternion(invRot);
    const yaw = Math.atan2(localDir.x, localDir.z);
    const pitch = Math.asin(Math.max(-1, Math.min(1, localDir.y)));
    const minYaw = t.turret.minYaw ?? -Math.PI;
    const maxYaw = t.turret.maxYaw ?? Math.PI;
    const minPitch = t.turret.minPitch ?? -Math.PI / 2;
    const maxPitch = t.turret.maxPitch ?? Math.PI / 2;
    if (yaw < minYaw || yaw > maxYaw || pitch < minPitch || pitch > maxPitch) continue;
    recordShotHelper(state, ship, projectileTarget ? null : target, dist);
    fireProjectile(state, ship, toTarget, {
      originPosition: origin,
      override: {
        damage: t.turret.damage,
        projectileSpeed: t.turret.projectileSpeed,
        range: t.turret.range,
        bulletType: t.turret.bulletType,
        targetId: projectileTarget ? undefined : target!.id,
        projectileCategory: t.turret.projectileCategory,
      },
      targetId: projectileTarget ? undefined : target!.id,
    });
    if (projectileTarget) {
      destroyEntity(state, projectileTarget);
    }
    t.turret.cooldown = t.turret.fireRate;
  }
}
