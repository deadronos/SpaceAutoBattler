import type { GameEntity, GameState, ShipEntity, TurretEntity } from '../types/index.js';
import { unregisterTurret } from './turretRegistry.js';

export function disposeGameState(state: GameState): void {
  for (const entity of [...state.world.entities]) {
    destroyEntity(state, entity);
  }

  state.eventQueue.free();
  state.physicsWorld.free();
  state.colliderLookup.clear();
}

export function destroyEntity(state: GameState, entity: GameEntity): void {
  if (entity.collider?.handle != null) state.colliderLookup.delete(entity.collider.handle);

  if (entity.collider && entity.collider.isValid()) {
    try {
      state.physicsWorld.removeCollider(entity.collider, true);
    } catch {
      // Collider may already be removed by Rapier when the rigid body is removed.
    }
  }

  if (entity.rigidBody && entity.rigidBody.isValid()) {
    try {
      state.physicsWorld.removeRigidBody(entity.rigidBody);
    } catch {
      // ignore
    }
  }

  if ((entity as ShipEntity).ship) {
    try {
      const map = state.turretsByShip;
      if (map) {
        const set = map.get((entity as ShipEntity).id);
        if (set) {
          for (const turret of Array.from(set)) {
            try {
              destroyEntity(state, turret as unknown as GameEntity);
            } catch {
              // continue destroying siblings
            }
          }
          map.delete((entity as ShipEntity).id);
        }
      }
    } catch {
      // ignore fallback
    }
  }

  try {
    if ((entity as TurretEntity).turret) {
      const turret = entity as TurretEntity;
      const parentId = turret.turret.parent?.id;
      if (parentId != null) {
        try {
          unregisterTurret(state, parentId, turret);
        } catch {
          // ignore unregister failures
        }
      }
    }
  } catch {
    // ignore type mismatches
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
  } catch {
    // ignore defensive cleanup failures
  }
}
