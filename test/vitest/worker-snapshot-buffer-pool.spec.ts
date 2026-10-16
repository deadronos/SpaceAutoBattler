import { describe, expect, it } from 'vite-plus/test';
import { emitSnapshot, returnTransferBuffer } from '../../src/worker/snapshotEmitter.js';
import { createWorkerState, type WorkerState } from '../../src/worker/workerState.js';
import {
  createTransformSoALayout,
  createTransformSoAViews,
} from '../../src/worker/transformsLayout.js';
import type { WorkerToMainMessage } from '../../src/worker/protocol.js';
import type { GameState } from '../../src/types/index.js';

function createTransferWorkerState(pooled: number): WorkerState {
  const ws = createWorkerState();
  ws.layout = createTransformSoALayout(8);
  ws.liveBuffer = new ArrayBuffer(ws.layout.totalBytes);
  ws.views = createTransformSoAViews(ws.layout, ws.liveBuffer);
  ws.transferBuffers = Array.from({ length: pooled }, () => new ArrayBuffer(ws.layout!.totalBytes));
  return ws;
}

const game = {
  queries: { ships: { entities: [] } },
  simulation: { lastTickIndex: 1 },
  time: 0,
} as unknown as GameState;

function emit(ws: WorkerState): ArrayBuffer {
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
    ws.views!.positions[0] = 42;
    const views = createTransformSoAViews(ws.layout!, emit(ws));
    expect(views.positions[0]).toBe(42);
  });

  it('ignores returned buffers whose size does not match the layout', () => {
    const ws = createTransferWorkerState(0);
    returnTransferBuffer(ws, new ArrayBuffer(4));
    expect(ws.transferBuffers).toHaveLength(0);
  });
});
