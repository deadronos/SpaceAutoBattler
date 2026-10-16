import type { AiOverrideSlice, TransformSoALayout } from './protocol.js';
import type { SlotAllocator } from './slotAllocator.js';
import type { createTransformSoAViews } from './transformsLayout.js';
import type { GameState } from '../types/index.js';

export interface WorkerState {
  aiOverrides: AiOverrideSlice;
  debugEnabled: boolean;
  loopId: ReturnType<typeof setInterval> | null;
  rapierLoaded: boolean;
  state: GameState | null;
  paused: boolean;
  layout: TransformSoALayout | null;
  usingShared: boolean;
  sharedBuffer: SharedArrayBuffer | null;
  liveBuffer: ArrayBuffer | null;
  /** Idle staging buffers for transfer-mode snapshots (refilled by the main thread). */
  transferBuffers: ArrayBuffer[];
  views: ReturnType<typeof createTransformSoAViews> | null;
  slots: SlotAllocator | null;
  slotByEntityId: Map<number, number>;
  lastShipIds: Set<number>;
}

export function createWorkerState(): WorkerState {
  return {
    aiOverrides: {
      aiVerticalEnabled: null,
      aiEngagementBoostEnabled: null,
      aiTickRateExperimentEnabled: null,
      aiRangePolicy: null,
      aiSmoothingEnabled: null,
      aiHysteresisEnabled: null,
      aiVerticalDampingEnabled: null,
    },
    debugEnabled: false,
    loopId: null,
    rapierLoaded: false,
    state: null,
    paused: false,
    layout: null,
    usingShared: false,
    sharedBuffer: null,
    liveBuffer: null,
    transferBuffers: [],
    views: null,
    slots: null,
    slotByEntityId: new Map<number, number>(),
    lastShipIds: new Set<number>(),
  };
}
