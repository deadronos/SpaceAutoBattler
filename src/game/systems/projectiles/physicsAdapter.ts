import { Quaternion, Vector3 } from 'three';
import type { GameState, ProjectileEntity } from '../../../types/index.js';
import type { ProjectileComponent } from '../../../types/combat.js';
import { enqueuePostPhysicsMutation } from '../../simulationQueue.js';
import {
  createKinematicBodyWithCollider,
  registerColliderHandle,
} from '../../utils/physicsFactory.js';

export interface ProjectileSpawnParams {
  state: GameState;
  position: Vector3;
  rotation: Quaternion;
  visualScale: number;
  colliderRadius: number;
  direction: Vector3;
  projectile: ProjectileComponent;
}

export function spawnProjectileEntity(
  params: ProjectileSpawnParams,
  onSpawn?: (projectile: ProjectileEntity) => void,
): void {
  const { state, position, rotation, colliderRadius, visualScale, projectile, direction } = params;

  const rotationComponents = { x: rotation.x, y: rotation.y, z: rotation.z, w: rotation.w };
  const positionComponents = { x: position.x, y: position.y, z: position.z };

  enqueuePostPhysicsMutation(state, () => {
    const { body, collider } = createKinematicBodyWithCollider(state, {
      position,
      rotation,
      collider: { type: 'ball', radius: colliderRadius },
    });

    const runtime = state.world.add({
      id: state.nextEntityId++,
      rigidBody: body,
      collider,
      transform: {
        position: new Vector3(positionComponents.x, positionComponents.y, positionComponents.z),
        rotation: new Quaternion(
          rotationComponents.x,
          rotationComponents.y,
          rotationComponents.z,
          rotationComponents.w,
        ),
        scale: visualScale,
      },
      projectile: { ...projectile },
      direction: direction.clone(),
    }) as ProjectileEntity;

    onSpawn?.(runtime);
    registerColliderHandle(state, collider, runtime);
  });
}
