import type { AiOverrideSlice, TransformSoALayout } from './protocol.js';
import type { SlotAllocator } from './slotAllocator.js';
import type { createSharedTransformPage, createTransformSoAViews } from './transformsLayout.js';
import type { GameState } from '../types/index.js';

export interface WorkerState {
  aiOverrides: AiOverrideSlice;
  debugEnabled: boolean;
  loopId: ReturnType<typeof setInterval> | null;
  rapierLoaded: boolean;
  state: GameState | null;
  paused: boolean;
  layout: TransformSoALayout | null;
  sharedPages: ReturnType<typeof createSharedTransformPage>[];
  liveBuffer: ArrayBuffer | null;
  /** Idle staging buffers for transfer-mode snapshots (refilled by the main thread). */
  transferBuffers: ArrayBuffer[];
  views: ReturnType<typeof createTransformSoAViews> | null;
  slots: SlotAllocator | null;
  slotByEntityId: Map<number, number>;
  currentShipIds: Set<number>;
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
    sharedPages: [],
    liveBuffer: null,
    transferBuffers: [],
    views: null,
    slots: null,
    slotByEntityId: new Map<number, number>(),
    currentShipIds: new Set<number>(),
  };
}
