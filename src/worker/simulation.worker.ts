import type { MainToWorkerMessage, WorkerToMainMessage } from './protocol.js';
import { createGameState, spawnInitialFleets } from '../game/state.js';
import { updateGame } from '../game/systems.js';
import { SeededRng } from '../utils/rng.js';
import { SlotAllocator } from './slotAllocator.js';
import { createTransformSoAViews } from './transformsLayout.js';
import { createWorkerState } from './workerState.js';
import { writeShipTransforms } from './shipTransformWriter.js';
import { emitSnapshot, returnTransferBuffer } from './snapshotEmitter.js';
import { setAiOverrideProvider } from '../game/config.js';

type WorkerScope = {
  postMessage: (message: unknown, transfer?: Transferable[]) => void;
  setInterval: typeof setInterval;
  clearInterval: typeof clearInterval;
  close: () => void;
  onmessage: ((event: MessageEvent) => void) | null;
};

const workerScope = globalThis as unknown as WorkerScope;

const ws = createWorkerState();
setAiOverrideProvider(() => ws.aiOverrides);

function post(message: WorkerToMainMessage): void {
  workerScope.postMessage(message);
}

function postWithTransfer(message: WorkerToMainMessage, transfer: Transferable[]): void {
  workerScope.postMessage(message, transfer);
}

function log(...args: unknown[]): void {
  if (!ws.debugEnabled) return;
  try {
    console.log('[sim-worker]', ...args);
  } catch {
    // ignore
  }
}

function startLoop(): void {
  if (ws.loopId !== null) return;

  if (!ws.state || !ws.layout || !ws.views || !ws.slots) {
    throw new Error('Worker loop started before init completed');
  }

  const dt = ws.state.simulation.step;
  const stepMs = Math.max(1, Math.round(dt * 1000));
  ws.loopId = workerScope.setInterval(() => {
    if (!ws.state || !ws.layout || !ws.views || !ws.slots) return;
    if (ws.paused) return;

    updateGame(ws.state, dt);
    writeShipTransforms(ws, ws.state);
    emitSnapshot(ws, ws.state, post, postWithTransfer);
  }, stepMs);
}

function stopLoop(): void {
  if (ws.loopId === null) return;
  workerScope.clearInterval(ws.loopId);
  ws.loopId = null;
}

workerScope.onmessage = (event: MessageEvent) => {
  void (async () => {
    const message = event.data as MainToWorkerMessage;

    try {
      switch (message.type) {
        case 'init': {
          ws.debugEnabled = Boolean(message.debug);
          ws.aiOverrides = message.aiOverrides;

          const initLayout = message.transforms.layout;
          ws.layout = initLayout;
          ws.usingShared = Boolean(message.transforms.buffer);
          ws.sharedBuffer = message.transforms.buffer ?? null;

          ws.slots = new SlotAllocator(initLayout.capacity);

          ws.state = await createGameState();
          ws.rapierLoaded = true;
          ws.state.rng = new SeededRng(message.seed);
          spawnInitialFleets(ws.state);

          ws.paused = Boolean(message.startPaused);

          if (ws.sharedBuffer) {
            ws.views = createTransformSoAViews(initLayout, ws.sharedBuffer);
          } else {
            ws.liveBuffer = new ArrayBuffer(initLayout.totalBytes);
            ws.views = createTransformSoAViews(initLayout, ws.liveBuffer);
            ws.transferBuffers = [
              new ArrayBuffer(initLayout.totalBytes),
              new ArrayBuffer(initLayout.totalBytes),
            ];
          }

          // Initialize the ship ID set before the first snapshot.
          ws.lastShipIds = new Set<number>();

          startLoop();
          post({
            type: 'ready',
            sabSupported: typeof SharedArrayBuffer !== 'undefined',
            rapierLoaded: ws.rapierLoaded,
            usingShared: ws.usingShared,
            layout: ws.layout,
          });
          log('ready');
          return;
        }

        case 'setAiOverrides': {
          ws.aiOverrides = message.aiOverrides;
          return;
        }

        case 'returnBuffer': {
          returnTransferBuffer(ws, message.buffer);
          return;
        }

        case 'setPaused': {
          ws.paused = message.paused;
          return;
        }

        case 'ping': {
          post({ type: 'pong', nonce: message.nonce, now: Date.now() });
          return;
        }

        case 'shutdown': {
          stopLoop();
          workerScope.close();
          return;
        }

        default: {
          const exhaustive: never = message;
          throw new Error(`Unhandled message: ${String(exhaustive)}`);
        }
      }
    } catch (error) {
      const err = error as Error;
      post({
        type: 'error',
        message: err.message || String(error),
        stack: err.stack,
      });
    }
  })();
};
