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
export type SimWorkerStepAIRequest = { type: 'step-ai'; payload: { dt: number; gameState: unknown } };
export type SimWorkerStepAIResult = { 
  type: 'step-ai-done'; 
  aiResults?: { ships: Array<{ id: number; targetId: number | null; aiState: unknown }> };
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
