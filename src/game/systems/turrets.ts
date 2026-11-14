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
import { asKinematicBody } from '../physics/safeKinematics.js';
import { enqueueKinematicTransform } from '../physics/kinematicBatch.js';
import { findPointDefenseTarget } from '../utils/targetSelection.js';
import {
  TEMP_TURRET_DIR,
  TEMP_QUAT as TURRET_TEMP_QUAT,
  TEMP_LOCAL_DIR,
} from '../../utils/tempVectors.js';

import { SpatialGrid } from '../../utils/spatialGrid.js';

// Hull size classification for turret priority targeting
const SMALL_HULLS = new Set(['fighter', 'corvette']);
const LARGE_HULLS = new Set(['frigate', 'destroyer', 'carrier']);

const TARGET_GRID_CELL_SIZE = 240;

function hullClass(ship: ShipEntity): number {
  if (SMALL_HULLS.has(ship.ship.hull)) return 0;
  if (LARGE_HULLS.has(ship.ship.hull)) return 1;
  return 2;
}

function createTurretTargetIndex() {
  const shipRank = new Map<ShipEntity, number>();
  return {
    ships: new SpatialGrid<ShipEntity>(TARGET_GRID_CELL_SIZE, (ship) => ship.transform.position),
    shipsByHull: Array.from(
      { length: 3 },
      () => new SpatialGrid<ShipEntity>(TARGET_GRID_CELL_SIZE, (ship) => ship.transform.position),
    ),
    shipRank,
    rank: (ship: ShipEntity) => shipRank.get(ship)!,
    threats: new SpatialGrid<ProjectileEntity>(
      TARGET_GRID_CELL_SIZE,
      (shot) => shot.transform.position,
    ),
    threatRank: new Map<ProjectileEntity, number>(),
    threatCandidates: [] as ProjectileEntity[],
  };
}

const targetIndexes = new WeakMap<GameState, ReturnType<typeof createTurretTargetIndex>>();

function getTargetIndex(state: GameState) {
  let index = targetIndexes.get(state);
  if (!index) {
    index = createTurretTargetIndex();
    targetIndexes.set(state, index);
  }
  return index;
}

function findPriorityTarget(
  index: ReturnType<typeof createTurretTargetIndex>,
  ship: ShipEntity,
  origin: Vector3,
  preferSmall: boolean,
): ShipEntity | null {
  const enemy = (candidate: ShipEntity) => candidate.ship.team !== ship.ship.team;
  let best: ShipEntity | null = null;
  let bestScore = Infinity;
  const preferredHull = preferSmall ? 0 : 1;
  for (let hull = 0; hull < index.shipsByHull.length; hull++) {
    const candidate = index.shipsByHull[hull]!.queryNearest(origin, enemy, index.rank);
    if (!candidate) continue;
    const bonus = hull === preferredHull ? -1000000 : hull === 2 ? 0 : 500000;
    const score = candidate.transform.position.distanceToSquared(origin) + bonus;
    if (
      score < bestScore ||
      (score === bestScore && best && index.rank(candidate) < index.rank(best))
    ) {
      best = candidate;
      bestScore = score;
    }
  }
  return best;
}

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
  let index: ReturnType<typeof createTurretTargetIndex> | undefined;
  let threatsBuilt = false;
  let hullsBuilt = false;
  for (const t of turrets) {
    const ship = t.turret.parent;
    const origin = getTurretWorldPosition(ship, t.turret);
    enqueueKinematicTransform(state, asKinematicBody(t.rigidBody), origin);

    t.turret.cooldown = Math.max(0, t.turret.cooldown - delta);
    if (t.turret.cooldown > 0) continue;

    if (!index) {
      index = getTargetIndex(state);
      index.shipRank.clear();
      const ships = state.queries.ships.entities as ShipEntity[];
      index.ships.repopulate(ships);
      for (let i = 0; i < ships.length; i++) index.shipRank.set(ships[i]!, i);
    }

    let target: ShipEntity | null = null;
    let projectileTarget: ProjectileEntity | null = null;
    if (t.turret.priority === 'antiProjectile') {
      if (!threatsBuilt) {
        index.threats.clear();
        index.threatRank.clear();
        const projectiles = state.queries.projectiles.entities as ProjectileEntity[];
        for (let i = 0; i < projectiles.length; i++) {
          const projectile = projectiles[i]!;
          const { homing, category } = projectile.projectile;
          if (!homing && category !== 'missile' && category !== 'torpedo') continue;
          index.threats.insert(projectile);
          index.threatRank.set(projectile, i);
        }
        threatsBuilt = true;
      }
      const threats = index.threats.queryBroad(
        origin,
        Math.max(0, t.turret.range),
        index.threatCandidates,
      );
      projectileTarget = findPointDefenseTarget(
        state,
        {
          origin,
          team: ship.ship.team,
          maxRange: t.turret.range,
          preferTargetId: ship.id,
        },
        threats,
        index.threatRank,
      );
    }

    if (!projectileTarget && t.turret.priority && t.turret.priority !== 'any') {
      if (!hullsBuilt) {
        for (const grid of index.shipsByHull) grid.clear();
        for (const candidate of index.shipRank.keys()) {
          index.shipsByHull[hullClass(candidate)]!.insert(candidate);
        }
        hullsBuilt = true;
      }
      target = findPriorityTarget(index, ship, origin, t.turret.priority === 'antiFighter');
    }

    if (!projectileTarget && !target) {
      target = index.ships.queryNearest(
        ship.transform.position,
        (candidate) => candidate.ship.team !== ship.ship.team,
        index.rank,
      );
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
      const projectiles = state.queries.projectiles.entities;
      const last = projectiles[projectiles.length - 1];
      const removedRank = index.threatRank.get(projectileTarget)!;
      index.threatRank.delete(projectileTarget);
      destroyEntity(state, projectileTarget);
      // Miniplex fills a removed slot with the tail. Preserve its updated
      // query order for later turrets without rebuilding the projectile grid.
      if (
        last &&
        last !== projectileTarget &&
        projectiles[removedRank] === last &&
        index.threatRank.has(last)
      ) {
        index.threatRank.set(last, removedRank);
      }
    }
    t.turret.cooldown = t.turret.fireRate;
  }
}
