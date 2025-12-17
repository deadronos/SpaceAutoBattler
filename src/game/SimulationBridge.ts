import type { AiOverrideSlice, MainToWorkerMessage, WorkerToMainMessage } from '../worker/protocol.js';

export function shouldEnableWorkerSimulation(): boolean {
  try {
    if (typeof window === 'undefined') return false;
    const params = new URLSearchParams(window.location.search);
    return params.get('sim_worker') === '1' || params.get('sim_worker') === 'true';
  } catch {
    return false;
  }
}

export function shouldDebugWorkerSimulation(): boolean {
  try {
    if (typeof window === 'undefined') return false;
    const params = new URLSearchParams(window.location.search);
    return params.get('sim_worker_debug') === '1' || params.get('sim_worker_debug') === 'true';
  } catch {
    return false;
  }
}

export class SimulationBridge {
  private readonly worker: Worker;
  private readyResolve: (() => void) | null = null;
  private readyReject: ((error: Error) => void) | null = null;
  private readonly readyPromise: Promise<void>;
  private readonly debugEnabled: boolean;

  constructor(options: { seed: number; aiOverrides: AiOverrideSlice; debug?: boolean }) {
    this.debugEnabled = Boolean(options.debug);
    this.worker = new Worker(new URL('../worker/simulation.worker.ts', import.meta.url));

    this.readyPromise = new Promise<void>((resolve, reject) => {
      this.readyResolve = resolve;
      this.readyReject = reject;
    });

    this.worker.onmessage = (event: MessageEvent) => {
      const message = event.data as WorkerToMainMessage;
      if (message.type === 'ready') {
        if (this.debugEnabled) {
          try {
            globalThis.console?.log?.('[SimulationBridge] worker ready', message);
          } catch {
            // ignore
          }
        }
        this.readyResolve?.();
        this.readyResolve = null;
        this.readyReject = null;
        return;
      }

      if (message.type === 'error') {
        const error = new Error(message.message);
        if (message.stack) error.stack = message.stack;
        this.readyReject?.(error);
        this.readyResolve = null;
        this.readyReject = null;
        return;
      }

      if (this.debugEnabled && message.type === 'pong') {
        try {
          globalThis.console?.log?.('[SimulationBridge] pong', message);
        } catch {
          // ignore
        }
      }

      // Phase 1: ignore other messages unless explicitly handled by a caller.
    };

    this.post({
      type: 'init',
      seed: options.seed,
      aiOverrides: options.aiOverrides,
      debug: options.debug,
    });
  }

  ready(): Promise<void> {
    return this.readyPromise;
  }

  setAiOverrides(aiOverrides: AiOverrideSlice): void {
    this.post({ type: 'setAiOverrides', aiOverrides });
  }

  ping(nonce: number): void {
    this.post({ type: 'ping', nonce });
  }

  dispose(): void {
    try {
      this.post({ type: 'shutdown' });
    } catch {
      // ignore
    }

    this.worker.terminate();
  }

  private post(message: MainToWorkerMessage): void {
    this.worker.postMessage(message);
  }
}
