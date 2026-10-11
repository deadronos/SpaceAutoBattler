import type { CreatedEntity, WorkerToMainMessage } from './protocol.js';
import { createTransformSoAViews } from './transformsLayout.js';
import { copyTransformViews } from './transformViews.js';
import { coerceHull, coerceTeam } from './entityCoercion.js';
import { freeSlot, getOrAllocateSlot } from './shipSlotTable.js';
import type { WorkerState } from './workerState.js';
import type { GameEntity, GameState } from '../types/index.js';

type Post = (message: WorkerToMainMessage) => void;
type PostWithTransfer = (message: WorkerToMainMessage, transfer: Transferable[]) => void;

export function computeShipDiffs(
  ws: WorkerState,
  game: GameState,
): { created: CreatedEntity[]; destroyed: number[] } {
  const ships = game.queries.ships.entities as GameEntity[];
  const currentIds = new Set<number>();
  const created: CreatedEntity[] = [];
  const destroyed: number[] = [];

  for (const entity of ships) {
    currentIds.add(entity.id);
    if (ws.lastShipIds.has(entity.id)) continue;

    const slot = getOrAllocateSlot(ws, entity.id);
    if (slot === null) continue;

    const ship = entity.ship;
    created.push({
      id: entity.id,
      kind: 'ship',
      slot,
      team: coerceTeam(ship?.team),
      hull: coerceHull(ship?.hull),
    });
  }

  for (const id of ws.lastShipIds) {
    if (currentIds.has(id)) continue;
    destroyed.push(id);
    freeSlot(ws, id);
  }

  ws.lastShipIds = currentIds;
  return { created, destroyed };
}

export function emitSnapshot(
  ws: WorkerState,
  game: GameState,
  post: Post,
  postWithTransfer: PostWithTransfer,
): void {
  if (!ws.layout) return;
  const ships = game.queries.ships.entities as GameEntity[];
  const { created, destroyed } = computeShipDiffs(ws, game);

  if (ws.usingShared) {
    post({
      type: 'snapshot',
      tick: game.simulation.lastTickIndex,
      time: game.time,
      shipCount: ships.length,
      created,
      destroyed,
    });
    return;
  }

  const buffer = ws.transferBuffers[ws.transferIndex];
  if (!buffer) return;

  // Copy from the live buffer into a staging buffer, then transfer that staging buffer.
  const stagingViews = createTransformSoAViews(ws.layout, buffer);
  if (ws.views) {
    copyTransformViews(ws.views, stagingViews);
  }

  ws.transferIndex = (ws.transferIndex + 1) % ws.transferBuffers.length;

  postWithTransfer(
    {
      type: 'snapshot',
      tick: game.simulation.lastTickIndex,
      time: game.time,
      shipCount: ships.length,
      created,
      destroyed,
      buffer,
    },
    [buffer],
  );

  // Replace the detached buffer slot with a fresh staging buffer.
  const detachedIndex =
    (ws.transferIndex + ws.transferBuffers.length - 1) % ws.transferBuffers.length;
  ws.transferBuffers[detachedIndex] = new ArrayBuffer(ws.layout.totalBytes);
}
