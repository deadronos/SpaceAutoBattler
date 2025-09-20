import { Quaternion, Vector3 } from 'three';
import type { GameState, ShipBlueprint, ShipEntity, ShipHull, ShipStats } from '../types/index.js';

export const SHIP_STATS: Record<ShipHull, ShipStats> = {
  fighter: {
    hull: 'fighter',
    maxHp: 40,
    damage: 8,
    fireRate: 0.9,
    projectileSpeed: 28,
    range: 18,
    speed: 14,
    scale: 1
  },
  corvette: {
    hull: 'corvette',
    maxHp: 75,
    damage: 12,
    fireRate: 1.2,
    projectileSpeed: 24,
    range: 22,
    speed: 11,
    scale: 1
  },
  frigate: {
    hull: 'frigate',
    maxHp: 120,
    damage: 16,
    fireRate: 1.5,
    projectileSpeed: 22,
    range: 26,
    speed: 9,
    scale: 1
  },
  destroyer: {
    hull: 'destroyer',
    maxHp: 200,
    damage: 22,
    fireRate: 1.8,
    projectileSpeed: 20,
    range: 30,
    speed: 7,
    scale: 1
  },
  carrier: {
    hull: 'carrier',
    maxHp: 320,
    damage: 28,
    fireRate: 2.2,
    projectileSpeed: 18,
    range: 34,
    speed: 5,
    scale: 1
  }
};

export function spawnShip(state: GameState, blueprint: ShipBlueprint): ShipEntity {
  const stats = SHIP_STATS[blueprint.hull];
  const rotation = new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), blueprint.heading);
  const position = blueprint.position.clone();

  const bodyDesc = state.rapier.RigidBodyDesc.kinematicPositionBased()
    .setTranslation(position.x, position.y, position.z)
    .setRotation({ x: rotation.x, y: rotation.y, z: rotation.z, w: rotation.w });
  const body = state.physicsWorld.createRigidBody(bodyDesc);

  // Collider tuned for models authored at 1:1 scale; adjust if individual GLBs vary.
  const colliderDesc = state.rapier.ColliderDesc.capsule(0.8, 0.6)
    .setActiveEvents(state.rapier.ActiveEvents.COLLISION_EVENTS)
    .setActiveCollisionTypes(state.rapier.ActiveCollisionTypes.ALL);
  const collider = state.physicsWorld.createCollider(colliderDesc, body);

  const entity: ShipEntity = {
    id: state.nextEntityId++,
    rigidBody: body,
    collider,
    transform: {
      position,
      rotation,
      scale: stats.scale
    },
    ship: {
      team: blueprint.team,
      hull: blueprint.hull,
      hp: stats.maxHp,
      maxHp: stats.maxHp,
      cooldown: stats.fireRate * state.rng.next(),
      fireRate: stats.fireRate,
      damage: stats.damage,
      projectileSpeed: stats.projectileSpeed,
      range: stats.range,
      speed: stats.speed
    },
    model: blueprint.hull
  };

  const registered = state.world.createEntity(entity) as ShipEntity;
  state.colliderLookup.set(collider.handle, registered);
  return registered;
}
