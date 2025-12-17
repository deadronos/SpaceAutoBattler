import type { AiOverrideSlice, MainToWorkerMessage, WorkerToMainMessage } from './protocol.js';

let aiOverrides: AiOverrideSlice = {
  aiVerticalEnabled: null,
  aiEngagementBoostEnabled: null,
  aiTickRateExperimentEnabled: null,
  aiRangePolicy: null,
  aiSmoothingEnabled: null,
  aiHysteresisEnabled: null,
  aiVerticalDampingEnabled: null,
};

let debugEnabled = false;
let loopId: ReturnType<typeof setInterval> | null = null;
let rapierLoaded = false;

function post(message: WorkerToMainMessage): void {
  self.postMessage(message);
}

function log(...args: unknown[]): void {
  if (!debugEnabled) return;
  try {
    console.log('[sim-worker]', ...args);
  } catch {
    // ignore
  }
}

function installUiStoreShim(): void {
  try {
    (globalThis as unknown as { __spaceAutobattlerUiStore?: unknown }).__spaceAutobattlerUiStore = {
      getState: () => aiOverrides,
    };
  } catch {
    // ignore
  }
}

async function ensureRapierLoaded(): Promise<void> {
  if (rapierLoaded) return;

  // Dynamically import so worker startup can be gated.
  const { default: Rapier } = await import('@dimforge/rapier3d-compat');
  await Rapier.init({});
  rapierLoaded = true;
}

function startLoop(): void {
  if (loopId !== null) return;

  const stepMs = 50;
  loopId = globalThis.setInterval(() => {
    // Intentionally a no-op for Phase 1 (smoke-test worker stability)
  }, stepMs);
}

function stopLoop(): void {
  if (loopId === null) return;
  globalThis.clearInterval(loopId);
  loopId = null;
}

globalThis.onmessage = (event: MessageEvent) => {
  void (async () => {
    const message = event.data as MainToWorkerMessage;

    try {
      switch (message.type) {
        case 'init': {
          debugEnabled = Boolean(message.debug);
          aiOverrides = message.aiOverrides;
          installUiStoreShim();
          await ensureRapierLoaded();
          startLoop();
          post({
            type: 'ready',
            sabSupported: typeof SharedArrayBuffer !== 'undefined',
            rapierLoaded,
          });
          log('ready');
          return;
        }

        case 'setAiOverrides': {
          aiOverrides = message.aiOverrides;
          installUiStoreShim();
          return;
        }

        case 'ping': {
          post({ type: 'pong', nonce: message.nonce, now: Date.now() });
          return;
        }

        case 'shutdown': {
          stopLoop();
          globalThis.close();
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
