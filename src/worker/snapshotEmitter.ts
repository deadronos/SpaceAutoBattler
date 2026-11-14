import type { CreatedEntity, WorkerToMainMessage } from './protocol.js';
import { createTransformSoAViews } from './transformsLayout.js';
import { writeShipTransforms } from './shipTransformWriter.js';
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
  const currentIds = ws.currentShipIds;
  currentIds.clear();
  for (const entity of ships) currentIds.add(entity.id);
  const created: CreatedEntity[] = [];
  const destroyed: number[] = [];

  for (const id of ws.slotByEntityId.keys()) {
    if (currentIds.has(id)) continue;
    destroyed.push(id);
    freeSlot(ws, id);
  }

  for (const entity of ships) {
    if (ws.slotByEntityId.has(entity.id)) continue;

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

  return { created, destroyed };
}

export function emitSnapshot(
  ws: WorkerState,
  game: GameState,
  post: Post,
  postWithTransfer: PostWithTransfer,
): void {
  if (!ws.layout) return;
  const sharedPage = ws.sharedPages.findIndex((page) => Atomics.load(page.ownership, 0) === 0);
  const page = ws.sharedPages[sharedPage];
  if (ws.sharedPages.length > 0 && !page) return;

  const ships = game.queries.ships.entities as GameEntity[];
  const { created, destroyed } = computeShipDiffs(ws, game);

  if (page) {
    writeShipTransforms(ws, game, page.views);
    Atomics.store(page.ownership, 0, 1);
    post({
      type: 'snapshot',
      tick: game.simulation.lastTickIndex,
      time: game.time,
      shipCount: ships.length,
      created,
      destroyed,
      sharedPage,
    });
    return;
  }

  // Copy from the live buffer into a staging buffer, then transfer that staging buffer. Staging
  // buffers come back from the main thread via `returnTransferBuffer`; allocate only when none
  // has been returned yet.
  const buffer = ws.transferBuffers.pop() ?? new ArrayBuffer(ws.layout.totalBytes);
  const stagingViews = createTransformSoAViews(ws.layout, buffer);
  if (ws.views) {
    writeShipTransforms(ws, game, ws.views);
    copyTransformViews(ws.views, stagingViews, ws.slotByEntityId.values());
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
