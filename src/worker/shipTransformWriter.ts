import type { GameEntity, GameState } from '../types/index.js';
import { getOrAllocateSlot } from './shipSlotTable.js';
import type { WorkerState } from './workerState.js';

export function writeShipTransforms(ws: WorkerState, game: GameState): void {
  if (!ws.views) return;

  const ships = game.queries.ships.entities as GameEntity[];

  for (const entity of ships) {
    const id = entity.id;
    const slot = getOrAllocateSlot(ws, id);
    if (slot === null) continue;

    const transform = entity.transform;
    if (!transform) continue;

    const p = transform.position;
    const r = transform.rotation;

    const pBase = slot * 3;
    ws.views.positions[pBase + 0] = p.x;
    ws.views.positions[pBase + 1] = p.y;
    ws.views.positions[pBase + 2] = p.z;

    const rBase = slot * 4;
    ws.views.rotations[rBase + 0] = r.x;
    ws.views.rotations[rBase + 1] = r.y;
    ws.views.rotations[rBase + 2] = r.z;
    ws.views.rotations[rBase + 3] = r.w;

    ws.views.scales[slot] = transform.scale;

    const ship = entity.ship;
    ws.views.shipHp[slot] = ship?.hp ?? 0;
    ws.views.shipShield[slot] = ship?.shield ?? 0;
    ws.views.shipThrust[slot] = entity.ai?.command?.thrust ?? 0;
  }
}
