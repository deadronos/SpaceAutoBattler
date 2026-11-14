import type { GameState, GameEntity, RigidBody } from '../../types/index.js';

const syncedByState = new WeakMap<GameState, Set<number>>();

function syncEntityTransform(entity: GameEntity): void {
  const translation = entity.rigidBody.translation();
  const rotation = entity.rigidBody.rotation();

  entity.transform.position.set(translation.x, translation.y, translation.z);
  entity.transform.rotation.set(rotation.x, rotation.y, rotation.z, rotation.w);
}

/**
 * Synchronizes entity transforms with their physics bodies.
 * Copies position and rotation from Rapier rigid bodies to the ECS components.
 *
 * @param {GameState} state - The game state.
 */
export function syncTransforms(state: GameState): void {
  let synced = syncedByState.get(state);
  if (!synced) {
    synced = new Set();
    syncedByState.set(state, synced);
  }
  synced.clear();

  const syncedIds = synced;
  state.physicsWorld.forEachActiveRigidBody((body: RigidBody) => {
    if (!body.isEnabled()) return;
    const colliderCount = body.numColliders();
    if (colliderCount <= 0) return;

    const colliderHandle = body.collider(0)?.handle;
    if (colliderHandle == null) return;
    const entity = state.colliderLookup.get(colliderHandle) as GameEntity | undefined;
    if (!entity || syncedIds.has(entity.id)) return;

    syncEntityTransform(entity);
    syncedIds.add(entity.id);
  });

  // Handle rare cases where kinematic bodies remain idle but still need to mirror their rigid body state.
  for (const entity of state.world.entities as GameEntity[]) {
    if (syncedIds.has(entity.id)) continue;
    const body = entity.rigidBody;
    if (body.isFixed() || body.isSleeping()) continue;
    syncEntityTransform(entity);
  }
}
