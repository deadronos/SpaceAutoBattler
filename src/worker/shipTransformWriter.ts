import type { GameEntity, GameState } from '../types/index.js';
import type { TransformSoAViews } from './transformsLayout.js';
import type { WorkerState } from './workerState.js';

export function writeShipTransforms(
  ws: WorkerState,
  game: GameState,
  views: TransformSoAViews,
): void {
  const ships = game.queries.ships.entities as GameEntity[];

  for (const entity of ships) {
    const slot = ws.slotByEntityId.get(entity.id);
    if (slot === undefined) continue;

    const transform = entity.transform;
    if (!transform) continue;

    const p = transform.position;
    const r = transform.rotation;

    const pBase = slot * 3;
    views.positions[pBase + 0] = p.x;
    views.positions[pBase + 1] = p.y;
    views.positions[pBase + 2] = p.z;

    const rBase = slot * 4;
    views.rotations[rBase + 0] = r.x;
    views.rotations[rBase + 1] = r.y;
    views.rotations[rBase + 2] = r.z;
    views.rotations[rBase + 3] = r.w;

    views.scales[slot] = transform.scale;

    const ship = entity.ship;
    views.shipHp[slot] = ship?.hp ?? 0;
    views.shipShield[slot] = ship?.shield ?? 0;
    views.shipThrust[slot] = entity.ai?.command?.thrust ?? 0;
  }
}
