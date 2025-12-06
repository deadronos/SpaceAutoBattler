import type { GameState, ProjectileEntity } from '../../../types/index.js';
import type { KinematicBody } from '../../physics/safeKinematics.js';
import { clampToWorld } from '../../config.js';
import {
  deferSetNextKinematicRotation,
  deferSetNextKinematicTranslation,
} from '../../physics/safeKinematics.js';
import { TEMP_POS } from './sharedTemps.js';
import { findShipById, steerProjectileTowardTarget } from './homing.js';

/**
 * Advances all active projectiles by one time step.
 * Updates position and applies steering for homing projectiles.
 * Beam projectiles are handled separately.
 *
 * @param {GameState} state - The game state.
 * @param {number} delta - The time step.
 */
export function advanceProjectiles(state: GameState, delta: number): void {
  const projectiles = state.queries.projectiles.entities as ProjectileEntity[];
  for (const projectile of projectiles) {
    const category = projectile.projectile.category ?? 'bullet';
    if (category === 'beam') {
      continue;
    }

    if (projectile.projectile.homing && projectile.projectile.targetId != null) {
      const target = findShipById(state, projectile.projectile.targetId);
      if (target) {
        steerProjectileTowardTarget(projectile, target, projectile.projectile.homing, delta);
      }
    }

    const move = projectile.projectile.speed * delta;
    const direction = projectile.direction;
    const current = projectile.transform.position;
    const next = TEMP_POS.copy(current).addScaledVector(direction, move);
    clampToWorld(next);

    projectile.transform.position.copy(next);
    deferSetNextKinematicTranslation(
      state,
      projectile.rigidBody as unknown as KinematicBody,
      next.x,
      next.y,
      next.z,
    );
    if (projectile.projectile.homing) {
      const rotation = projectile.transform.rotation;
      deferSetNextKinematicRotation(
        state,
        projectile.rigidBody as unknown as KinematicBody,
        rotation.x,
        rotation.y,
        rotation.z,
        rotation.w,
      );
    }
  }
}
