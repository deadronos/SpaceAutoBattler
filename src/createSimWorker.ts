// src/createSimWorker.ts - TypeScript helper to create and manage the sim Worker
export type SimMessage = any;

export function createSimWorker(url: string = './simWorker.js') {
  const worker = new Worker(url, { type: 'module' });
  const listeners = new Map<string, (msg: any) => void>();

  worker.onmessage = (ev: MessageEvent) => {
    const msg = ev.data;
    const cb = listeners.get(msg && msg.type);
    if (cb) cb(msg);
  };

  return {
    post(msg: SimMessage) { worker.postMessage(msg); },
    on(type: string, cb: (msg: any) => void) { listeners.set(type, cb); },
    terminate() { worker.terminate(); }
  };
}

export default createSimWorker;
