import type { WorkerState } from './workerState.js';

export function getOrAllocateSlot(ws: WorkerState, entityId: number): number | null {
  const existing = ws.slotByEntityId.get(entityId);
  if (existing !== undefined) return existing;
  if (!ws.slots) return null;
  const slot = ws.slots.allocate();
  if (slot === null) return null;
  ws.slotByEntityId.set(entityId, slot);
  return slot;
}

export function freeSlot(ws: WorkerState, entityId: number): void {
  const slot = ws.slotByEntityId.get(entityId);
  if (slot === undefined) return;
  ws.slotByEntityId.delete(entityId);
  ws.slots?.free(slot);
}
