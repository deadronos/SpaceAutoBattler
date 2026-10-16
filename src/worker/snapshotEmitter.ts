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

  // Copy from the live buffer into a staging buffer, then transfer that staging buffer. Staging
  // buffers come back from the main thread via `returnTransferBuffer`; allocate only when none
  // has been returned yet.
  const buffer = ws.transferBuffers.pop() ?? new ArrayBuffer(ws.layout.totalBytes);
  const stagingViews = createTransformSoAViews(ws.layout, buffer);
  if (ws.views) {
    copyTransformViews(ws.views, stagingViews);
  }

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
}

/** Upper bound on idle staging buffers kept for reuse. */
const MAX_POOLED_TRANSFER_BUFFERS = 4;

/**
 * Takes back a staging buffer the main thread has finished reading so the next snapshot can
 * reuse it. Buffers that no longer match the layout (or exceed the pool cap) are dropped.
 */
export function returnTransferBuffer(ws: WorkerState, buffer: ArrayBuffer): void {
  if (!ws.layout || buffer.byteLength !== ws.layout.totalBytes) return;
  if (ws.transferBuffers.length >= MAX_POOLED_TRANSFER_BUFFERS) return;
  ws.transferBuffers.push(buffer);
}
