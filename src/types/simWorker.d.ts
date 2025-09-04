export type SimWorkerInitMessage = { type: 'init-physics' };
export type SimWorkerInitDone = { type: 'init-physics-done'; ok: boolean };
export type SimWorkerStepRequest = { type: 'step-physics'; payload: { dt: number } };
export type SimWorkerStepResult = { type: 'step-physics-done'; transformsBuffer?: ArrayBuffer; transforms?: any[] };

declare global {
  interface Worker {
    // allow more specific typing if desired
  }
}

export {};
