export type AiOverrideSlice = {
  aiVerticalEnabled: boolean | null;
  aiEngagementBoostEnabled: boolean | null;
  aiTickRateExperimentEnabled: boolean | null;
  aiRangePolicy: string | null;
  aiSmoothingEnabled?: boolean | null;
  aiHysteresisEnabled?: boolean | null;
  aiVerticalDampingEnabled?: boolean | null;
};

export type MainToWorkerMessage =
  | {
      type: 'init';
      seed: number;
      aiOverrides: AiOverrideSlice;
      debug?: boolean;
    }
  | {
      type: 'setAiOverrides';
      aiOverrides: AiOverrideSlice;
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
    }
  | {
      type: 'pong';
      nonce: number;
      now: number;
    }
  | {
      type: 'error';
      message: string;
      stack?: string;
    };
