// Migrated debug script: original version imported from `src/core/*` APIs.
// The codebase now places simulation code under `src/game/*` and ship types are simplified.
// This script is a small runtime check that spawns a few ships and selects a nearest-enemy target.

import { createGameState } from '../src/game/state.js';
import { spawnShip } from '../src/game/ships.js';

function findNearestEnemy(state, originEntity) {
  const originPos = originEntity.transform.position;
  let best = null;
  let bestDist = Infinity;
  for (const e of state.world.entities) {
    if (!e.ship) continue;
    if (e.ship.team === originEntity.ship.team) continue;
    if (e.ship.hp <= 0) continue;
    const p = e.transform.position;
    const dx = p.x - originPos.x;
    const dz = p.z - originPos.z;
    const d2 = dx * dx + dz * dz;
    if (d2 < bestDist) {
      bestDist = d2;
      best = e;
    }
  }
  return best;
}

async function run() {
  const state = await createGameState();

  const ship = spawnShip(state, { team: 'red', hull: 'frigate', position: { x: 0, y: 0, z: 0 }, heading: 0 });
  const weakerFar = spawnShip(state, { team: 'blue', hull: 'destroyer', position: { x: 600, y: 0, z: 0 }, heading: 0 });
  weakerFar.ship.hp = weakerFar.ship.maxHp * 0.2;
  const strongerNear = spawnShip(state, { team: 'blue', hull: 'fighter', position: { x: 200, y: 0, z: 0 }, heading: 0 });
  strongerNear.ship.hp = strongerNear.ship.maxHp;

  const nearest = findNearestEnemy(state, ship);
  console.log('DEBUG_SCRIPT: nearest enemy id', nearest?.id ?? null, 'team', nearest?.ship?.team ?? null);
  ship.targetId = nearest ? nearest.id : null;
  console.log('DEBUG_SCRIPT: final ship.targetId', ship.targetId);
}

run();
