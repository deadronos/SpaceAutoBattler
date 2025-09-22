import { World as ECSWorld } from 'miniplex';
import { Vector3 } from 'three';
import Rapier from '@dimforge/rapier3d-compat';
import type {
  GameEntity,
  GameState,
  ShipHull,
  Team,
  TurretEntity,
  ShipEntity,
} from '../types/index.js';
import { SeededRng } from '../utils/rng.js';
import { spawnShip } from './ships.js';
import { unregisterTurret } from './turretRegistry.js';
import { AI_CONFIG, WORLD_HALF } from './config.js';

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
    // turretsByShip is used to track turret ECS entities per parent ship for
    // efficient cascade removal. It is optional in GameState but we create
    // it here for the runtime.
    turretsByShip: new Map(),
    nextEntityId: 1,
    time: 0,
    queries: {
      ships: world.archetype('ship'),
      projectiles: world.archetype('projectile'),
      turrets: world.archetype('turret'),
    },
    rng: new SeededRng(1337),
    paused: false,
    timeScale: 1,
    ai: {
      enabled: AI_CONFIG.v2Enabled,
      tickInterval: 1 / AI_CONFIG.tickRateHz,
      maxPerTick: AI_CONFIG.maxPerTick,
      accumulator: 0,
      tickIndex: 0,
      cursor: 0,
      slices: AI_CONFIG.slices,
      assignments: {
        escorts: new Map(),
      },
    },
    blackboard: {
      tickIndex: 0,
      teamPosture: {
        blue: 'hold',
        red: 'hold',
      },
      allyCentroid: {
        blue: new Vector3(),
        red: new Vector3(),
      },
      nearestEnemy: new Map(),
      threatToVip: new Map(),
      tmpVectors: [new Vector3(), new Vector3(), new Vector3(), new Vector3()],
    },
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
  // Defensive: some entities may not have a collider (or it may already be removed)
  if (entity.collider?.handle != null) state.colliderLookup.delete(entity.collider.handle);

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

  // If this entity is a ship, also destroy any turret entities that reference it as parent.
  // Turret entities are created separately and hold a .turret.parent link to their ship.
  // When a ship is removed we must remove those turret entities as well to avoid
  // orphaned turrets continuing to act after their parent is gone.
  // If this entity is a ship, also destroy any turret entities that reference it as parent.
  // Turret entities are created separately and hold a .turret.parent link to their ship.
  // When a ship is removed we must remove those turret entities as well to avoid
  // orphaned turrets continuing to act after their parent is gone.
  if ((entity as ShipEntity).ship) {
    // Prefer fast path: if turretsByShip exists, use it to find turret entities
    try {
      const map = state.turretsByShip;
      if (map) {
        const set = map.get((entity as ShipEntity).id);
        if (set) {
          for (const t of Array.from(set)) {
            try {
              destroyEntity(state, t as unknown as GameEntity);
            } catch {
              // continue
            }
          }
          map.delete((entity as ShipEntity).id);
        }
      }
    } catch {
      // ignore failures and fall back to query scan below
    }

    // NOTE: Removed fallback scan. We now rely on the turretsByShip registry
    // and the centralized register/unregister helpers to keep turret bookkeeping
    // consistent. Tests and production code must use registerTurret/unregisterTurret
    // when creating/destroying turret entities. Keeping the fallback scan was
    // redundant and caused O(N) work on ship destruction.
  }

  // If we're destroying a turret entity, ensure it's removed from any turretsByShip registry.
  try {
    if ((entity as TurretEntity).turret) {
      const te = entity as TurretEntity;
      const parentId = te.turret.parent?.id;
      if (parentId != null) {
        try {
          unregisterTurret(state, parentId, te);
        } catch {
          // ignore
        }
      }
    }
  } catch {
    // ignore
  }

  const registered = entity as Parameters<GameState['world']['destroyEntity']>[0];
  state.world.destroyEntity(registered);

  // Defensive: some test harnesses or lightweight mocks may keep separate
  // `.entities` arrays on query objects. Ensure the entity is removed from
  // any such arrays to avoid stale references in tests and non-ideal mocks.
  try {
    const queries = state.queries as unknown as Record<string, { entities?: GameEntity[] }>;
    for (const k of Object.keys(queries)) {
      const q = queries[k];
      if (q && Array.isArray(q.entities)) {
        const i = q.entities.indexOf(entity as GameEntity);
        if (i >= 0) q.entities.splice(i, 1);
      }
    }
  } catch {
    // ignore any issues; this is purely defensive
  }
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
      heading: 0,
    });

    spawnShip(state, {
      hull,
      team: 'red',
      position: new Vector3(WORLD_HALF * 0.06 - index * 18, 0, offsetZ),
      heading: Math.PI,
    });
  });
}

// Spawn a single random ship for the team at a reasonable location.
export function spawnRandomShip(state: GameState, team: Team): void {
  const hulls: ShipHull[] = ['fighter', 'corvette', 'frigate', 'destroyer', 'carrier'];
  const hull = hulls[Math.floor(state.rng.next() * hulls.length)];

  const radius = WORLD_HALF * 0.1;
  const angle = state.rng.next() * Math.PI * 2;
  const zSpread = WORLD_HALF * 0.2;
  const x = (team === 'blue' ? -1 : 1) * (WORLD_HALF * 0.05 + state.rng.next() * radius);
  const z = Math.cos(angle) * radius * 0.5 + (state.rng.next() - 0.5) * zSpread;
  const heading = team === 'blue' ? 0 : Math.PI;

  spawnShip(state, {
    hull,
    team,
    position: new Vector3(x, 0, z),
    heading,
  });
}

// Reset the simulation entities and respawn starting fleets.
export function resetGame(state: GameState): void {
  // Destroy all entities safely
  for (const e of [...state.world.entities]) {
    destroyEntity(state, e);
  }
  // Respawn baseline fleets
  spawnInitialFleets(state);
  state.ai.cursor = 0;
  state.ai.accumulator = 0;
  state.ai.tickIndex = 0;
  state.ai.assignments.escorts.clear();
  state.blackboard.nearestEnemy.clear();
  state.blackboard.threatToVip.clear();
  state.blackboard.teamPosture.blue = 'hold';
  state.blackboard.teamPosture.red = 'hold';
  state.blackboard.allyCentroid.blue.set(0, 0, 0);
  state.blackboard.allyCentroid.red.set(0, 0, 0);
}
