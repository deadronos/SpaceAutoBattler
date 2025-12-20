export type AiOverrideSlice = {
  aiVerticalEnabled: boolean | null;
  aiEngagementBoostEnabled: boolean | null;
  aiTickRateExperimentEnabled: boolean | null;
  aiRangePolicy: string | null;
  aiSmoothingEnabled?: boolean | null;
  aiHysteresisEnabled?: boolean | null;
  aiVerticalDampingEnabled?: boolean | null;
};

import type { TransformSoALayout } from './transformsLayout.js';
export type { TransformSoALayout } from './transformsLayout.js';

export type CreatedEntity = {
  id: number;
  kind: 'ship';
  slot: number;
  team: 'blue' | 'red';
  hull: 'fighter' | 'corvette' | 'frigate' | 'destroyer' | 'carrier';
};

export type MainToWorkerMessage =
  | {
      type: 'init';
      seed: number;
      aiOverrides: AiOverrideSlice;
      transforms: {
        layout: TransformSoALayout;
        buffer?: SharedArrayBuffer;
      };
      startPaused?: boolean;
      debug?: boolean;
    }
  | {
      type: 'setAiOverrides';
      aiOverrides: AiOverrideSlice;
    }
  | {
      type: 'setPaused';
      paused: boolean;
    }
  | {
      type: 'ping';
      nonce: number;
    }
  | {
      type: 'shutdown';
    };

export type WorkerToMainMessage =
  | {
      type: 'ready';
      sabSupported: boolean;
      rapierLoaded: boolean;
      usingShared: boolean;
      layout: TransformSoALayout;
    }
  | {
      type: 'pong';
      nonce: number;
      now: number;
    }
  | {
      type: 'snapshot';
      tick: number;
      time: number;
      shipCount: number;
      created: CreatedEntity[];
      destroyed: number[];
      buffer?: ArrayBuffer;
    }
  | {
      type: 'error';
      message: string;
      stack?: string;
    };
