import type { GameEntity, GameState } from '../../types/index.js';
import type { RigidBody } from '../../types/index.js';
import {
  createKinematicBodyWithCollider,
  registerColliderHandle,
  unregisterColliderHandle,
  type CreateBodyColliderOpts,
} from './physicsFactory.js';

type ColliderLike = {
  handle: number;
  isValid(): boolean;
};

/**
 * Creates a kinematic body + collider pair and registers them for lifecycle tracking.
 * Bodies created through this manager will be cleaned up when `destroyBody` is called.
 *
 * @returns The created body and collider, plus a cleanup function.
 */
export function createTrackedBody(
  state: GameState,
  opts: CreateBodyColliderOpts,
  entity: GameEntity,
): { body: RigidBody; collider: ColliderLike | null; dispose: () => void } {
  const { body, collider } = createKinematicBodyWithCollider(state, opts);
  registerColliderHandle(state, collider, entity);
  return {
    body,
    collider,
    dispose: () => {
      if (collider && collider.isValid()) {
        state.physicsWorld.removeCollider(collider, true);
      }
      if (body && body.isValid()) {
        state.physicsWorld.removeRigidBody(body);
      }
      unregisterColliderHandle(state, collider);
    },
  };
}

/**
 * Destroys a tracked body and its collider, cleaning up from the physics world
 * and collider lookup table.
 */
export function destroyBody(
  state: GameState,
  body: RigidBody,
  collider: ColliderLike | null,
): void {
  if (collider && collider.isValid()) {
    state.physicsWorld.removeCollider(collider, true);
  }
  if (body && body.isValid()) {
    state.physicsWorld.removeRigidBody(body);
  }
  unregisterColliderHandle(state, collider);
}
