import { World as ECSWorld } from 'miniplex';
import { Vector3 } from 'three';
import Rapier from '@dimforge/rapier3d-compat';
import type { GameEntity, GameState, ShipHull } from '../types/index.js';
import { SeededRng } from '../utils/rng.js';
import { spawnShip } from './ships.js';
import { WORLD_HALF } from './config.js';

export async function createGameState(): Promise<GameState> {
  await Rapier.init();
  const physicsWorld = new Rapier.World({ x: 0, y: 0, z: 0 });
  const eventQueue = new Rapier.EventQueue(true);
  const world = new ECSWorld<GameEntity>();

  const state: GameState = {
    rapier: Rapier,
    physicsWorld,
    eventQueue,
    world,
    colliderLookup: new Map(),
    nextEntityId: 1,
    time: 0,
    queries: {
      ships: world.archetype('ship'),
      projectiles: world.archetype('projectile')
    },
    rng: new SeededRng(1337)
  };

  return state;
}

export function disposeGameState(state: GameState): void {
  for (const entity of [...state.world.entities]) {
    destroyEntity(state, entity);
  }

  state.eventQueue.free();
  state.physicsWorld.free();
  state.colliderLookup.clear();
}

export function destroyEntity(state: GameState, entity: GameEntity): void {
  state.colliderLookup.delete(entity.collider.handle);

  if (entity.collider && entity.collider.isValid()) {
    try {
      state.physicsWorld.removeCollider(entity.collider, true);
    } catch {
      // ignore, collider might have already been removed by Rapier when removing the rigid body
    }
  }

  if (entity.rigidBody && entity.rigidBody.isValid()) {
    try {
      state.physicsWorld.removeRigidBody(entity.rigidBody);
    } catch {
      // ignore
    }
  }

  const registered = entity as Parameters<GameState['world']['destroyEntity']>[0];
  state.world.destroyEntity(registered);
}

export function spawnInitialFleets(state: GameState): void {
  const formation: ShipHull[] = ['fighter', 'corvette', 'frigate', 'destroyer', 'carrier'];
  const spacing = 60;

  formation.forEach((hull, index) => {
    const offsetZ = (index - (formation.length - 1) / 2) * spacing;
    spawnShip(state, {
      hull,
      team: 'blue',
  position: new Vector3(-WORLD_HALF * 0.06 + index * 18, 0, offsetZ),
      heading: 0
    });

    spawnShip(state, {
      hull,
      team: 'red',
  position: new Vector3(WORLD_HALF * 0.06 - index * 18, 0, offsetZ),
      heading: Math.PI
    });
  });
}
