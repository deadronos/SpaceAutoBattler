import type { GameState, ProjectileEntity } from '../../../types/index.js';
import type { KinematicBody } from '../../physics/safeKinematics.js';
import { clampToWorld } from '../../config.js';
import {
  deferSetNextKinematicRotation,
  deferSetNextKinematicTranslation,
} from '../../physics/safeKinematics.js';
import { enqueueDeferredMutation } from '../../simulationQueue.js';
import { TEMP_POS } from './sharedTemps.js';
import { findShipById, steerProjectileTowardTarget } from './homing.js';
import { getProjectileBuffers, flushProjectileBuffers } from './buffers.js';

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
  const buffers = getProjectileBuffers(state);

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

    const body = projectile.rigidBody as unknown as KinematicBody;

    // Batch translation
    if (buffers.t_count < buffers.t_bodies.length) {
      buffers.t_bodies[buffers.t_count] = body;
      const i3 = buffers.t_count * 3;
      buffers.t_values[i3] = next.x;
      buffers.t_values[i3 + 1] = next.y;
      buffers.t_values[i3 + 2] = next.z;
      buffers.t_count++;
    } else {
      deferSetNextKinematicTranslation(state, body, next.x, next.y, next.z);
    }

    if (projectile.projectile.homing) {
      const rotation = projectile.transform.rotation;
      // Batch rotation
      if (buffers.r_count < buffers.r_bodies.length) {
        buffers.r_bodies[buffers.r_count] = body;
        const i4 = buffers.r_count * 4;
        buffers.r_values[i4] = rotation.x;
        buffers.r_values[i4 + 1] = rotation.y;
        buffers.r_values[i4 + 2] = rotation.z;
        buffers.r_values[i4 + 3] = rotation.w;
        buffers.r_count++;
      } else {
        deferSetNextKinematicRotation(state, body, rotation.x, rotation.y, rotation.z, rotation.w);
      }
    }
  }

  if (buffers.t_count > 0 || buffers.r_count > 0) {
    enqueueDeferredMutation(state, () => flushProjectileBuffers(buffers));
  }
}
