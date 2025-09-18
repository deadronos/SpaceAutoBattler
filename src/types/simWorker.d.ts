export type SimWorkerInitMessage = { type: 'init-physics' };
export type SimWorkerInitDone = { type: 'init-physics-done'; ok: boolean };
export type SimWorkerStepRequest = { type: 'step-physics'; payload: { dt: number } };
export type SimWorkerStepResult = {
  type: 'step-physics-done';
  transformsBuffer?: ArrayBuffer;
  transforms?: any[];
};

// AI-related message types
export type SimWorkerInitAIMessage = { type: 'init-ai'; payload: unknown };
export type SimWorkerInitAIDone = { type: 'init-ai-done'; ok: boolean; error?: string };
export type SimWorkerStepAIRequest = { 
  type: 'step-ai'; 
  payload: { 
    dt: number; 
    shipsBuffer?: ArrayBuffer;
    bulletsBuffer?: ArrayBuffer;
    behaviorConfig?: unknown;
    tick?: number;
  } 
};
export type SimWorkerStepAIResult = { 
  type: 'step-ai-done'; 
  aiResultsBuffer?: ArrayBuffer;
  shipCount?: number;
  error?: string;
};
export type SimWorkerDisposeAI = { type: 'dispose-ai' };
export type SimWorkerDisposeAIDone = { type: 'dispose-ai-done' };

declare global {
  interface Worker {
    // allow more specific typing if desired
  }
}

export {};
