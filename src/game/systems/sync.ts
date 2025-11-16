import type { GameState, GameEntity, RigidBody } from '../../types/index.js';

function syncEntityTransform(entity: GameEntity): void {
  const translation = entity.rigidBody.translation();
  const rotation = entity.rigidBody.rotation();

  entity.transform.position.set(translation.x, translation.y, translation.z);
  entity.transform.rotation.set(rotation.x, rotation.y, rotation.z, rotation.w);
}

export function syncTransforms(state: GameState): void {
  const synced = new Set<number>();

  state.physicsWorld.forEachActiveRigidBody((body: RigidBody) => {
    if (!body.isEnabled()) return;
    const colliderCount = body.numColliders();
    if (colliderCount <= 0) return;

    const colliderHandle = body.collider(0)?.handle;
    if (colliderHandle == null) return;
    const entity = state.colliderLookup.get(colliderHandle) as GameEntity | undefined;
    if (!entity || synced.has(entity.id)) return;

    syncEntityTransform(entity);
    synced.add(entity.id);
  });

  // Handle rare cases where kinematic bodies remain idle but still need to mirror their rigid body state.
  for (const entity of state.world.entities as GameEntity[]) {
    if (synced.has(entity.id)) continue;
    const body = entity.rigidBody;
    if (body.isFixed() || body.isSleeping()) continue;
    syncEntityTransform(entity);
  }
}
