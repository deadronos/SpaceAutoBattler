// Thin shim that re-exports the canonical TypeScript implementation during
// the migration. This keeps runtime imports working while `src/createSimWorker.ts`
// is the authoritative source.
export * from './createSimWorker.ts';
export { default } from './createSimWorker.ts';
// createSimWorker.js - minimal runtime stub while migrating to TypeScript
// The canonical implementation lives in src/createSimWorker.ts. This JS
// fallback provides a small runtime helper so code that imports
// `createSimWorker` continues to work during the migration.
export function createSimWorker(url = './simWorker.js') {
	// Try to create a module Worker when the environment supports it.
	try {
		if (typeof Worker !== 'undefined') {
			try {
				const w = new Worker(url, { type: 'module' });
				const listeners = new Map();
				w.onmessage = (ev) => {
					const msg = ev.data;
					const cb = listeners.get(msg && msg.type);
					if (cb) cb(msg);
				};
				return {
					post(m) { w.postMessage(m); },
					on(type, cb) { listeners.set(type, cb); },
					terminate() { try { w.terminate(); } catch (e) {} }
				};
			} catch (e) {
				// Worker creation failed (maybe unsupported by host); fall back
				return null;
			}
		}
	} catch (e) {
		// ignore and fall back
	}
	// Default: no worker available in this environment — caller should use
	// the in-process simulation fallback.
	return null;
}
