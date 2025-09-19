import { Quaternion, Vector3 } from 'three';
import type {
  GameEntity,
  GameState,
  ProjectileEntity,
  ShipEntity
} from '../types/index.js';
import { destroyEntity } from './state.js';

const FORWARD = new Vector3(0, 0, 1);
const TEMP_DIR = new Vector3();
const TEMP_POS = new Vector3();

export function updateGame(state: GameState, delta: number): void {
  state.time += delta;

  prepareShips(state, delta);
  advanceProjectiles(state, delta);

  state.physicsWorld.step(state.eventQueue);

  syncTransforms(state);
  resolveProjectiles(state, delta);
}

function prepareShips(state: GameState, delta: number): void {
  const ships = state.queries.ships.entities as ShipEntity[];

  for (const ship of ships) {
    ship.ship.cooldown = Math.max(0, ship.ship.cooldown - delta);
    const target = findNearestEnemy(state, ship);

    if (!target) {
      ship.rigidBody.setNextKinematicTranslation({
        x: ship.transform.position.x,
        y: ship.transform.position.y,
        z: ship.transform.position.z
      });
      continue;
    }

    const direction = TEMP_DIR.subVectors(target.transform.position, ship.transform.position);
    const distance = direction.length();
    if (distance > 0.0001) {
      direction.normalize();
    } else {
      direction.set(0, 0, 1);
    }

    orientTowards(ship, direction);

    if (distance > ship.ship.range * 0.6) {
      const moveDistance = Math.min(ship.ship.speed * delta, Math.max(distance - ship.ship.range * 0.55, 0));
      const nextPosition = TEMP_POS
        .copy(ship.transform.position)
        .addScaledVector(direction, moveDistance)
        .clampLength(0, 40);

      ship.rigidBody.setNextKinematicTranslation({
        x: nextPosition.x,
        y: nextPosition.y,
        z: nextPosition.z
      });
    } else {
      ship.rigidBody.setNextKinematicTranslation({
        x: ship.transform.position.x,
        y: ship.transform.position.y,
        z: ship.transform.position.z
      });
    }

    if (distance <= ship.ship.range && ship.ship.cooldown <= 0) {
      fireProjectile(state, ship, direction);
      ship.ship.cooldown = ship.ship.fireRate;
    }
  }
}

function advanceProjectiles(state: GameState, delta: number): void {
  const projectiles = state.queries.projectiles.entities as ProjectileEntity[];
  for (const projectile of projectiles) {
    const move = projectile.projectile.speed * delta;
    const direction = projectile.direction;
    const current = projectile.transform.position;
    const next = TEMP_POS.copy(current).addScaledVector(direction, move);

    projectile.rigidBody.setNextKinematicTranslation({ x: next.x, y: next.y, z: next.z });
  }
}

function syncTransforms(state: GameState): void {
  for (const entity of state.world.entities as GameEntity[]) {
    const translation = entity.rigidBody.translation();
    const rotation = entity.rigidBody.rotation();

    entity.transform.position.set(translation.x, translation.y, translation.z);
    entity.transform.rotation.set(rotation.x, rotation.y, rotation.z, rotation.w);
  }
}

function resolveProjectiles(state: GameState, delta: number): void {
  const ships = state.queries.ships.entities as ShipEntity[];
  const projectiles = state.queries.projectiles.entities as ProjectileEntity[];
  const toRemove = new Set<GameEntity>();

  for (const projectile of projectiles) {
    projectile.projectile.ttl -= delta;
    if (projectile.projectile.ttl <= 0) {
      toRemove.add(projectile);
      continue;
    }

    for (const ship of ships) {
      if (ship.ship.team === projectile.projectile.team) continue;
      const distance = ship.transform.position.distanceTo(projectile.transform.position);
      const impactRadius = ship.transform.scale * 0.9;
      if (distance > impactRadius) continue;

      ship.ship.hp -= projectile.projectile.damage;
      toRemove.add(projectile);

      if (ship.ship.hp <= 0) {
        toRemove.add(ship);
      }
      break;
    }
  }

  for (const entity of toRemove) {
    destroyEntity(state, entity);
  }
}

function orientTowards(ship: ShipEntity, direction: Vector3): void {
  const rotation = new Quaternion().setFromUnitVectors(FORWARD, direction);
  const bank = Math.max(Math.min(direction.x * 0.6, 0.6), -0.6);
  const banking = new Quaternion().setFromAxisAngle(FORWARD, -bank);
  rotation.multiply(banking);

  ship.transform.rotation.copy(rotation);
  ship.rigidBody.setNextKinematicRotation({ x: rotation.x, y: rotation.y, z: rotation.z, w: rotation.w });
}

function fireProjectile(state: GameState, origin: ShipEntity, direction: Vector3): void {
  const muzzleOffset = origin.transform.scale * 1.6;
  const startPosition = origin.transform.position.clone().addScaledVector(direction, muzzleOffset);
  const rotation = new Quaternion().setFromUnitVectors(FORWARD, direction);

  const bodyDesc = state.rapier.RigidBodyDesc.kinematicPositionBased()
    .setTranslation(startPosition.x, startPosition.y, startPosition.z)
    .setRotation({ x: rotation.x, y: rotation.y, z: rotation.z, w: rotation.w });
  const body = state.physicsWorld.createRigidBody(bodyDesc);

  const colliderDesc = state.rapier.ColliderDesc.ball(0.2)
    .setActiveEvents(state.rapier.ActiveEvents.COLLISION_EVENTS)
    .setActiveCollisionTypes(state.rapier.ActiveCollisionTypes.ALL);
  const collider = state.physicsWorld.createCollider(colliderDesc, body);

  const lifetime = Math.min(origin.ship.range / origin.ship.projectileSpeed, 4);

  const projectile = state.world.createEntity({
    id: state.nextEntityId++,
    rigidBody: body,
    collider,
    transform: {
      position: startPosition,
      rotation,
      scale: 0.2
    },
    projectile: {
      team: origin.ship.team,
      damage: origin.ship.damage,
      ttl: lifetime,
      maxTtl: lifetime,
      speed: origin.ship.projectileSpeed
    },
    direction: direction.clone()
  }) as ProjectileEntity;

  state.colliderLookup.set(collider.handle, projectile);
}

export function findNearestEnemy(state: GameState, origin: ShipEntity): ShipEntity | null {
  const ships = state.queries.ships.entities as ShipEntity[];
  let closest: ShipEntity | null = null;
  let shortest = Number.POSITIVE_INFINITY;

  for (const ship of ships) {
    if (ship === origin) continue;
    if (ship.ship.team === origin.ship.team) continue;
    const distance = origin.transform.position.distanceTo(ship.transform.position);
    if (distance < shortest) {
      shortest = distance;
      closest = ship;
    }
  }

  return closest;
}
