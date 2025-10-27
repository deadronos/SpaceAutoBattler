import type { Collider, RigidBody } from '../../types/index.js';
import type { GameEntity, GameState } from '../../types/index.js';
import type { Quaternion, Vector3 } from 'three';

type ColliderShapeConfig =
  | { type: 'ball'; radius: number }
  | { type: 'capsule'; halfHeight: number; radius: number };

export interface CreateBodyColliderOpts {
  position?: Vector3;
  rotation?: Quaternion | { x: number; y: number; z: number; w: number };
  collider: ColliderShapeConfig;
  sensor?: boolean;
  activeEvents?: number;
  activeCollisionTypes?: number;
  ccd?: boolean;
}

function toRotationObject(rotation?: Quaternion | { x: number; y: number; z: number; w: number }): {
  x: number;
  y: number;
  z: number;
  w: number;
} {
  if (!rotation) {
    return { x: 0, y: 0, z: 0, w: 1 };
  }
  if (typeof (rotation as Quaternion).x === 'number') {
    const rot = rotation as Quaternion;
    return { x: rot.x, y: rot.y, z: rot.z, w: rot.w };
  }
  return rotation;
}

function ensureNumbers(position?: Vector3): { x: number; y: number; z: number } {
  if (!position) {
    return { x: 0, y: 0, z: 0 };
  }
  return { x: position.x, y: position.y, z: position.z };
}

export function createKinematicBodyWithCollider(
  state: GameState,
  opts: CreateBodyColliderOpts,
): { body: RigidBody; collider: Collider | null } {
  const translation = ensureNumbers(opts.position);
  const rotation = toRotationObject(opts.rotation);

  const bodyDesc = state.rapier.RigidBodyDesc.kinematicPositionBased()
    .setTranslation(translation.x, translation.y, translation.z)
    .setRotation(rotation);
  if (opts.ccd) {
    bodyDesc.setCcdEnabled(true);
  }

  const body = state.physicsWorld.createRigidBody(bodyDesc) as RigidBody;

  const colliderDesc = (() => {
    if (opts.collider.type === 'ball') {
      return state.rapier.ColliderDesc.ball(opts.collider.radius);
    }
    return state.rapier.ColliderDesc.capsule(opts.collider.halfHeight, opts.collider.radius);
  })();

  const activeEvents = opts.activeEvents ?? state.rapier.ActiveEvents.COLLISION_EVENTS;
  const activeCollisionTypes = opts.activeCollisionTypes ?? state.rapier.ActiveCollisionTypes.ALL;

  colliderDesc.setActiveEvents(activeEvents).setActiveCollisionTypes(activeCollisionTypes);

  if (typeof opts.sensor === 'boolean') {
    colliderDesc.setSensor(opts.sensor as unknown as boolean);
  }

  const collider = state.physicsWorld.createCollider(colliderDesc, body) as Collider | null;

  return { body, collider };
}

export function registerColliderHandle(
  state: GameState,
  collider: Collider | null | undefined,
  entity: GameEntity,
): void {
  const handle = collider?.handle;
  if (handle == null) {
    return;
  }
  state.colliderLookup.set(handle, entity);
}

export function unregisterColliderHandle(
  state: GameState,
  collider: Collider | null | undefined,
): void {
  const handle = collider?.handle;
  if (handle == null) {
    return;
  }
  state.colliderLookup.delete(handle);
}

export function createAndRegisterEntityBody<T extends GameEntity>(
  state: GameState,
  entityFactory: (body: RigidBody, collider: Collider | null) => T,
  opts: CreateBodyColliderOpts,
  registerEntity?: (entity: T) => void,
): { entity: T; collider: Collider | null; body: RigidBody } {
  const { body, collider } = createKinematicBodyWithCollider(state, opts);
  const entity = entityFactory(body, collider);
  if (registerEntity) {
    registerEntity(entity);
  }
  registerColliderHandle(state, collider, entity);
  return { entity, collider, body };
}
