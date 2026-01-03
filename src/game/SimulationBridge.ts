import type {
  AiOverrideSlice,
  MainToWorkerMessage,
  TransformSoALayout,
  WorkerToMainMessage,
} from '../worker/protocol.js';
import { createTransformSoALayout, createTransformSoAViews } from '../worker/transformsLayout.js';

export function shouldEnableWorkerSimulation(): boolean {
  try {
    if (typeof window === 'undefined') return false;
    const params = new URLSearchParams(window.location.search);
    const enabled = params.get('sim_worker') === '1' || params.get('sim_worker') === 'true';
    const render =
      params.get('sim_worker_render') === '1' || params.get('sim_worker_render') === 'true';
    return enabled || render;
  } catch {
    return false;
  }
}

export function shouldRenderWorkerShips(): boolean {
  try {
    if (typeof window === 'undefined') return false;
    const params = new URLSearchParams(window.location.search);
    const render =
      params.get('sim_worker_render') === '1' || params.get('sim_worker_render') === 'true';
    const renderOnly =
      params.get('sim_worker_render_only') === '1' ||
      params.get('sim_worker_render_only') === 'true';
    return render || renderOnly;
  } catch {
    return false;
  }
}

export function shouldRenderWorkerShipsOnly(): boolean {
  try {
    if (typeof window === 'undefined') return false;
    const params = new URLSearchParams(window.location.search);
    return (
      params.get('sim_worker_render_only') === '1' ||
      params.get('sim_worker_render_only') === 'true'
    );
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
  private isReady = false;
  private readonly debugEnabled: boolean;
  private readonly layout: TransformSoALayout;
  private readonly usingShared: boolean;
  private readonly sharedBuffer: SharedArrayBuffer | null;
  private sharedViews: ReturnType<typeof createTransformSoAViews> | null = null;
  private latestTransferBuffer: ArrayBuffer | null = null;
  private latestTransferViews: ReturnType<typeof createTransformSoAViews> | null = null;
  private latestTick: number | null = null;
  private latestShipCount: number | null = null;
  private lastError: { message: string; stack?: string } | null = null;
  private slotByShipId = new Map<number, number>();
  private metaByShipId = new Map<number, { team: 'blue' | 'red' }>();

  constructor(options: {
    seed: number;
    aiOverrides: AiOverrideSlice;
    capacity?: number;
    startPaused?: boolean;
    debug?: boolean;
  }) {
    this.debugEnabled = Boolean(options.debug);
    const capacity = options.capacity ?? 4096;
    this.layout = createTransformSoALayout(capacity);

    const canUseShared =
      typeof SharedArrayBuffer !== 'undefined' &&
      (globalThis as unknown as { crossOriginIsolated?: boolean }).crossOriginIsolated === true;
    this.usingShared = canUseShared;
    const buffer = canUseShared ? new SharedArrayBuffer(this.layout.totalBytes) : undefined;
    this.sharedBuffer = buffer ?? null;
    if (this.sharedBuffer) {
      this.sharedViews = createTransformSoAViews(this.layout, this.sharedBuffer);
    }

    this.worker = new Worker(new URL('../worker/simulation.worker.ts', import.meta.url), {
      type: 'module',
    });

    this.readyPromise = new Promise<void>((resolve, reject) => {
      this.readyResolve = resolve;
      this.readyReject = reject;
    });

    this.worker.onmessage = (event: MessageEvent) => {
      const message = event.data as WorkerToMainMessage;
      if (message.type === 'ready') {
        this.isReady = true;
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
        this.isReady = false;
        this.lastError = { message: message.message, stack: message.stack };
        const error = new Error(message.message);
        if (message.stack) error.stack = message.stack;
        this.readyReject?.(error);
        this.readyResolve = null;
        this.readyReject = null;
        if (this.debugEnabled) {
          try {
            globalThis.console?.error?.('[SimulationBridge] worker error', error);
          } catch {
            // ignore
          }
        }
        return;
      }

      if (this.debugEnabled && message.type === 'pong') {
        try {
          globalThis.console?.log?.('[SimulationBridge] pong', message);
        } catch {
          // ignore
        }
      }

      if (message.type === 'snapshot') {
        this.latestTick = message.tick;
        this.latestShipCount = message.shipCount;

        for (const created of message.created) {
          if (created.kind !== 'ship') continue;
          this.slotByShipId.set(created.id, created.slot);
          this.metaByShipId.set(created.id, { team: created.team });
        }

        for (const destroyedId of message.destroyed) {
          this.slotByShipId.delete(destroyedId);
          this.metaByShipId.delete(destroyedId);
        }

        if (message.buffer) {
          this.latestTransferBuffer = message.buffer;
          this.latestTransferViews = createTransformSoAViews(this.layout, message.buffer);
          if (this.debugEnabled) {
            try {
              const x = this.latestTransferViews.positions[0] ?? 0;
              globalThis.console?.log?.('[SimulationBridge] snapshot', {
                tick: message.tick,
                ships: message.shipCount,
                firstX: x,
                created: message.created.length,
                destroyed: message.destroyed.length,
              });
            } catch {
              // ignore
            }
          }
        }

        return;
      }

      // Phase 1: ignore other messages unless explicitly handled by a caller.
    };

    this.worker.onerror = (event: ErrorEvent) => {
      this.isReady = false;
      this.lastError = {
        message: event.message || 'Worker error',
        stack: typeof event.error?.stack === 'string' ? event.error.stack : undefined,
      };

      const error = new Error(this.lastError.message);
      if (this.lastError.stack) error.stack = this.lastError.stack;
      this.readyReject?.(error);
      this.readyResolve = null;
      this.readyReject = null;

      if (this.debugEnabled) {
        try {
          globalThis.console?.error?.('[SimulationBridge] worker.onerror', event);
        } catch {
          // ignore
        }
      }
    };

    this.worker.onmessageerror = () => {
      this.isReady = false;
      this.lastError = { message: 'Worker message deserialization failed' };
    };

    this.post({
      type: 'init',
      seed: options.seed,
      aiOverrides: options.aiOverrides,
      transforms: {
        layout: this.layout,
        buffer,
      },
      startPaused: options.startPaused,
      debug: options.debug,
    });
  }

  ready(): Promise<void> {
    return this.readyPromise;
  }

  getStatus(): {
    ready: boolean;
    tick: number | null;
    shipCount: number | null;
    usingShared: boolean;
    error: { message: string; stack?: string } | null;
  } {
    return {
      ready: this.isReady,
      tick: this.latestTick,
      shipCount: this.latestShipCount,
      usingShared: this.usingShared,
      error: this.lastError,
    };
  }

  setAiOverrides(aiOverrides: AiOverrideSlice): void {
    this.post({ type: 'setAiOverrides', aiOverrides });
  }

  ping(nonce: number): void {
    this.post({ type: 'ping', nonce });
  }

  setPaused(paused: boolean): void {
    this.post({ type: 'setPaused', paused });
  }

  getLatestViews(): ReturnType<typeof createTransformSoAViews> | null {
    return this.latestTransferViews ?? this.sharedViews;
  }

  getShipSlots(): ReadonlyMap<number, number> {
    return this.slotByShipId;
  }

  getShipMeta(): ReadonlyMap<number, { team: 'blue' | 'red' }> {
    return this.metaByShipId;
  }

  sampleWorkerShipMotion(limit = 10): {
    tick: number | null;
    shipCount: number | null;
    ships: Array<{
      id: number;
      slot: number;
      position: { x: number; y: number; z: number };
      rotation: { x: number; y: number; z: number; w: number };
      hp: number;
      shield: number;
      thrust: number;
    }>;
  } {
    const buffer = this.latestTransferBuffer;
    const views = buffer ? createTransformSoAViews(this.layout, buffer) : this.sharedViews;
    if (!views) {
      return { tick: this.latestTick, shipCount: this.latestShipCount, ships: [] };
    }

    const ships: Array<{
      id: number;
      slot: number;
      position: { x: number; y: number; z: number };
      rotation: { x: number; y: number; z: number; w: number };
      hp: number;
      shield: number;
      thrust: number;
    }> = [];

    const max = Math.max(0, Math.floor(limit));
    for (const [id, slot] of this.slotByShipId) {
      if (ships.length >= max) break;

      const pBase = slot * 3;
      const rBase = slot * 4;

      ships.push({
        id,
        slot,
        position: {
          x: views.positions[pBase + 0] ?? 0,
          y: views.positions[pBase + 1] ?? 0,
          z: views.positions[pBase + 2] ?? 0,
        },
        rotation: {
          x: views.rotations[rBase + 0] ?? 0,
          y: views.rotations[rBase + 1] ?? 0,
          z: views.rotations[rBase + 2] ?? 0,
          w: views.rotations[rBase + 3] ?? 1,
        },
        hp: views.shipHp[slot] ?? 0,
        shield: views.shipShield[slot] ?? 0,
        thrust: views.shipThrust[slot] ?? 0,
      });
    }

    return { tick: this.latestTick, shipCount: this.latestShipCount, ships };
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
