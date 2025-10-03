import type { GameState, GameEntity } from '../../types/index.js';

export function syncTransforms(state: GameState): void {
  for (const entity of state.world.entities as GameEntity[]) {
    const translation = entity.rigidBody.translation();
    const rotation = entity.rigidBody.rotation();

    entity.transform.position.set(translation.x, translation.y, translation.z);
    entity.transform.rotation.set(rotation.x, rotation.y, rotation.z, rotation.w);
  }
}
