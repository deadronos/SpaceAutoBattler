import { describe, expect, it } from 'vite-plus/test';
import { emitSnapshot, returnTransferBuffer } from '../../src/worker/snapshotEmitter.js';
import { createWorkerState, type WorkerState } from '../../src/worker/workerState.js';
import {
  createSharedTransformPage,
  createTransformSoALayout,
  SHARED_TRANSFORM_PAGE_OWNERSHIP_BYTES,
  createTransformSoAViews,
} from '../../src/worker/transformsLayout.js';
import type { WorkerToMainMessage } from '../../src/worker/protocol.js';
import { SlotAllocator } from '../../src/worker/slotAllocator.js';
import type { GameState } from '../../src/types/index.js';

function createTransferWorkerState(pooled: number): WorkerState {
  const ws = createWorkerState();
  ws.layout = createTransformSoALayout(8);
  ws.slots = new SlotAllocator(8);
  ws.liveBuffer = new ArrayBuffer(ws.layout.totalBytes);
  ws.views = createTransformSoAViews(ws.layout, ws.liveBuffer);
  ws.transferBuffers = Array.from({ length: pooled }, () => new ArrayBuffer(ws.layout!.totalBytes));
  return ws;
}

function makeGame(ids: number[] = [], x = 42, tick = 1): GameState {
  return {
    queries: {
      ships: {
        entities: ids.map((id) => ({
          id,
          transform: {
            position: { x, y: 1, z: 2 },
            rotation: { x: 0, y: 0, z: 0, w: 1 },
            scale: 3,
          },
        })),
      },
    },
    simulation: { lastTickIndex: tick },
    time: 0,
  } as unknown as GameState;
}

function emit(ws: WorkerState, game = makeGame()): ArrayBuffer {
  let sent: ArrayBuffer | undefined;
  emitSnapshot(
    ws,
    game,
    () => {},
    (message: WorkerToMainMessage) => {
      if (message.type === 'snapshot') sent = message.buffer;
    },
  );
  if (!sent) throw new Error('no snapshot buffer sent');
  return sent;
}

describe('worker snapshot transfer-buffer pool', () => {
  it('reuses a buffer returned by the main thread instead of allocating', () => {
    const ws = createTransferWorkerState(1);
    const first = emit(ws);
    expect(ws.transferBuffers).toHaveLength(0);

    returnTransferBuffer(ws, first);
    expect(emit(ws)).toBe(first);
  });

  it('allocates a fresh buffer when the pool is empty', () => {
    const ws = createTransferWorkerState(0);
    const buffer = emit(ws);
    expect(buffer.byteLength).toBe(ws.layout!.totalBytes);
  });

  it('copies the live transforms into the transferred buffer', () => {
    const ws = createTransferWorkerState(1);
    const layout = ws.layout!;
    const initial = emit(ws, makeGame([1, 2, 3]));
    returnTransferBuffer(ws, initial);
    const staging = createTransformSoAViews(layout, initial);
    staging.positions[3] = -7;
    staging.positions[9] = -8;

    const views = createTransformSoAViews(layout, emit(ws, makeGame([1, 3], 15, 2)));
    expect(views.positions[0]).toBe(15);
    expect(views.positions[3]).toBe(-7);
    expect(views.positions[6]).toBe(15);
    expect(views.positions[9]).toBe(-8);
    expect(views.rotations[11]).toBe(1);
    expect(views.scales[2]).toBe(3);
  });

  it('ignores returned buffers whose size does not match the layout', () => {
    const ws = createTransferWorkerState(0);
    returnTransferBuffer(ws, new ArrayBuffer(4));
    expect(ws.transferBuffers).toHaveLength(0);
  });
});

it('never overwrites a shared page before the main thread returns it', () => {
  const ws = createTransferWorkerState(0);
  const layout = ws.layout!;
  ws.sharedPages = Array.from({ length: 2 }, () =>
    createSharedTransformPage(
      layout,
      new SharedArrayBuffer(layout.totalBytes + SHARED_TRANSFORM_PAGE_OWNERSHIP_BYTES),
    ),
  );
  const messages: WorkerToMainMessage[] = [];
  const publish = (ids: number[], tick: number) => {
    emitSnapshot(
      ws,
      makeGame(ids, tick * 10, tick),
      (message) => messages.push(message),
      () => {
        throw new Error('shared mode must not transfer the snapshot');
      },
    );
  };

  publish([1], 1);
  publish([1], 2);
  publish([2], 3);
  expect(messages).toMatchObject([
    { type: 'snapshot', sharedPage: 0, tick: 1, created: [{ id: 1, slot: 0 }] },
    { type: 'snapshot', sharedPage: 1, tick: 2, created: [] },
  ]);
  expect(ws.sharedPages.map((page) => page.views.positions[0])).toEqual([10, 20]);

  Atomics.store(ws.sharedPages[0]!.ownership, 0, 0);
  publish([2], 4);
  expect(messages[2]).toMatchObject({
    type: 'snapshot',
    sharedPage: 0,
    tick: 4,
    created: [{ id: 2, slot: 0 }],
    destroyed: [1],
  });
  expect(ws.sharedPages.map((page) => page.views.positions[0])).toEqual([40, 20]);
});
