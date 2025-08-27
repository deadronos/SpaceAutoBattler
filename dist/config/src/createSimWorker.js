export function createSimWorker(url = './simWorker.js') {
    const worker = new Worker(url, { type: 'module' });
    const listeners = new Map();
    worker.onmessage = (ev) => {
        const msg = ev.data;
        const cb = listeners.get(msg && msg.type);
        if (cb)
            cb(msg);
    };
    return {
        post(msg) { worker.postMessage(msg); },
        on(type, cb) { listeners.set(type, cb); },
        terminate() { worker.terminate(); }
    };
}
export default createSimWorker;
