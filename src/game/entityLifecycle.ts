import type { GameEntity, GameState, ShipEntity, TurretEntity } from '../types/index.js';
import { unregisterTurret } from './turretRegistry.js';
import {
  reportPhysicsError,
  reportLifecycleError,
  reportQueryError,
} from '../utils/errorReporting.js';

/**
 * Cleans up the entire game state, destroying all entities and freeing physics resources.
 *
 * @param {GameState} state - The game state to dispose.
 */
export function disposeGameState(state: GameState): void {
  for (const entity of [...state.world.entities]) {
    destroyEntity(state, entity);
  }

  state.eventQueue.free();
  state.physicsWorld.free();
  state.colliderLookup.clear();
}

/**
 * Destroys a single entity and cleans up its resources (physics bodies, colliders, lookups).
 *
 * @param {GameState} state - The game state containing the entity.
 * @param {GameEntity} entity - The entity to destroy.
 */
export function destroyEntity(state: GameState, entity: GameEntity): void {
  if (entity.collider?.handle != null) state.colliderLookup.delete(entity.collider.handle);

  if (entity.collider && entity.collider.isValid()) {
    try {
      state.physicsWorld.removeCollider(entity.collider, true);
    } catch (error) {
      // Expected: Rapier removes colliders automatically when rigid body is freed
      reportPhysicsError('removeCollider', entity.id, error);
    }
  }

  if (entity.rigidBody && entity.rigidBody.isValid()) {
    try {
      state.physicsWorld.removeRigidBody(entity.rigidBody);
    } catch (error) {
      // Expected: Rigid body may be invalidated by WASM runtime during cleanup
      reportPhysicsError('removeRigidBody', entity.id, error);
    }
  }

  if ((entity as ShipEntity).ship) {
    try {
      state.shipById?.delete((entity as ShipEntity).id);
      const map = state.turretsByShip;
      if (map) {
        const set = map.get((entity as ShipEntity).id);
        if (set) {
          for (const turret of Array.from(set)) {
            try {
              destroyEntity(state, turret as unknown as GameEntity);
            } catch (error) {
              // Expected: Sibling turret may already be destroyed; continue cleanup
              reportLifecycleError('destroy', 'Turret', (turret as TurretEntity).id, error);
            }
          }
          map.delete((entity as ShipEntity).id);
        }
      }
    } catch (error) {
      // Expected: Ship cleanup races with turret destruction
      reportLifecycleError('destroy', 'Ship', (entity as ShipEntity).id, error);
    }
  }

  try {
    if ((entity as TurretEntity).turret) {
      const turret = entity as TurretEntity;
      const parentId = turret.turret.parent?.id;
      if (parentId != null) {
        try {
          unregisterTurret(state, parentId, turret);
        } catch (error) {
          // Expected: Parent ship may already be destroyed
          reportLifecycleError('destroy', 'TurretUnregister', turret.id, error);
        }
      }
    }
  } catch (error) {
    // Expected: Entity type check may fail on corrupted state
    reportLifecycleError('destroy', 'TurretTypeCheck', entity.id, error);
  }

  state.world.remove(entity as GameEntity);

  try {
    const queries = state.queries as unknown as Record<string, { entities?: GameEntity[] }>;
    for (const key of Object.keys(queries)) {
      const query = queries[key];
      if (query && Array.isArray(query.entities)) {
        const index = query.entities.indexOf(entity as GameEntity);
        if (index >= 0) query.entities.splice(index, 1);
      }
    }
  } catch (error) {
    // Expected: Query structure may be modified during iteration
    reportQueryError('entityCleanup', error);
  }
}
