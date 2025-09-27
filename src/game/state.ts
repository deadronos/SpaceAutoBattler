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
import { spawnShip, SHIP_STATS } from './ships.js';
import { unregisterTurret } from './turretRegistry.js';
import { AI_CONFIG, WORLD_HALF, SPAWN_CONFIG, clampToWorld } from './config.js';

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
    nextExplosionId: 1,
    time: 0,
    queries: {
      ships: world.archetype('ship'),
      projectiles: world.archetype('projectile'),
      turrets: world.archetype('turret'),
    },
    rng: new SeededRng(1337),
    paused: false,
    timeScale: 1,
    uiFlags: {
      hudHealthBars: false,
    },
    explosions: [],
    explosionPool: [],
    simulation: {
      step: 1 / 20,
      accumulator: 0,
      maxSubSteps: 5,
      alpha: 0,
      lastTickIndex: 0,
      lastTickStart: 0,
      lastTickDuration: 1 / 20,
    },
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
      metrics: {
        totalDecisions: 0,
        totalSkipped: 0,
        budgetHits: 0,
        lastDecisions: 0,
        lastSkipped: 0,
        lastSliceSize: 0,
        lastTotalShips: 0,
        verticalSamples: 0,
        verticalAboveThreshold: 0,
        inBandSamples: 0,
        inBandSatisfied: 0,
        openingAggressiveIntents: 0,
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
      strengthRatio: {
        blue: 1,
        red: 1,
      },
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
  const maxRange = Math.max(...Object.values(SHIP_STATS).map((stats) => stats.range));
  const separation = Math.max(200, maxRange * SPAWN_CONFIG.initialSeparationFactor);
  const halfSeparation = separation * 0.5;
  const baseSpacing = Math.max(120, separation * 0.25);
  const depthJitter = separation * 0.2;
  const verticalSpread = WORLD_HALF * SPAWN_CONFIG.verticalSpreadFactor;
  const radialJitter = separation * 0.15;
  const blueAnchorX = -halfSeparation;
  const redAnchorX = halfSeparation;
  const anchorYOffsetRange = SPAWN_CONFIG.anchorYRandomization ? verticalSpread * 0.5 : 0;
  const blueAnchorY = SPAWN_CONFIG.anchorYRandomization ? (state.rng.next() - 0.5) * anchorYOffsetRange : 0;
  const redAnchorY = SPAWN_CONFIG.anchorYRandomization ? (state.rng.next() - 0.5) * anchorYOffsetRange : 0;

  formation.forEach((hull, index) => {
    const offset = index - (formation.length - 1) / 2;
    const zBase = offset * baseSpacing;
    const zJitter = (state.rng.next() - 0.5) * depthJitter;
    const yOffset = (state.rng.next() - 0.5) * verticalSpread;
    const xJitter = (state.rng.next() - 0.5) * radialJitter;

    const bluePosition = new Vector3(blueAnchorX + xJitter, blueAnchorY + yOffset, zBase + zJitter);
    const redPosition = new Vector3(redAnchorX - xJitter, redAnchorY - yOffset, -(zBase + zJitter));

    clampToWorld(bluePosition);
    clampToWorld(redPosition);

    spawnShip(state, {
      hull,
      team: 'blue',
      position: bluePosition,
      heading: 0,
    });

    spawnShip(state, {
      hull,
      team: 'red',
      position: redPosition,
      heading: Math.PI,
    });
  });
}
// Spawn a single random ship for the team at a reasonable location.
export function spawnRandomShip(state: GameState, team: Team): void {
  const hulls: ShipHull[] = ['fighter', 'corvette', 'frigate', 'destroyer', 'carrier'];
  const hull = hulls[Math.floor(state.rng.next() * hulls.length)];

  const lateralRadius = WORLD_HALF * 0.25;
  const verticalSpread = WORLD_HALF * 0.15;
  const anchorX = (team === 'blue' ? -1 : 1) * WORLD_HALF * 0.3;
  const x = anchorX + (state.rng.next() - 0.5) * lateralRadius;
  const z = (state.rng.next() - 0.5) * lateralRadius;
  const y = (state.rng.next() - 0.5) * verticalSpread;
  const heading = team === 'blue' ? 0 : Math.PI;

  const position = new Vector3(x, y, z);
  clampToWorld(position);

  spawnShip(state, {
    hull,
    team,
    position,
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




