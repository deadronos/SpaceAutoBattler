// src/simWorker.ts - simulation worker implementation (compiled to JS and loaded as module Worker)
import { simulateStep } from './simulate';
import { applySimpleAI } from './behavior';
import { srand } from './rng';
import { normalizeTurrets, normalizeStateShips } from './entities';
import type { /* Bounds type can be extended in src/types if needed */ } from './types';
import { getDefaultBounds } from './config/simConfig';

type Bounds = { W: number; H: number };

let state: any = null;
let bounds: Bounds = getDefaultBounds();
let simDtMs = 16;
let running = false;
let acc = 0;
let last = 0;

function postSnapshot() {
	try {
		postMessage({ type: 'snapshot', state });
		// Clear transient event arrays so the worker does not repeatedly resend
		// the same events on every snapshot. The snapshot is cloned by postMessage
		// so it's safe to clear them here.
		try { clearTransientEvents(state); } catch (e) { /* ignore */ }
	} catch (e) {
		// ignore
	}
}

// exported for tests: clear transient worker event arrays after snapshot
export function clearTransientEvents(s: any) {
  if (!s || typeof s !== 'object') return;
  try {
    if (Array.isArray(s.explosions)) s.explosions.length = 0;
    if (Array.isArray(s.shieldHits)) s.shieldHits.length = 0;
    if (Array.isArray(s.healthHits)) s.healthHits.length = 0;
  } catch (e) { /* ignore */ }
}

function tick() {
	if (!running) return;
	const now = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
	if (!last) last = now;
	acc += now - last; last = now;
	if (acc > 250) acc = 250;
		while (acc >= simDtMs) {
			try {
					// Apply deterministic AI before physics step
					applySimpleAI(state as any, simDtMs / 1000, bounds);
					simulateStep(state, simDtMs / 1000, bounds);
			} catch (e) {
				const errAny: any = e as any;
				const stack = errAny && errAny.stack ? errAny.stack : '';
				postMessage({ type: 'error', message: String(e), stack });
			}
			acc -= simDtMs;
		}
	postSnapshot();
	setTimeout(tick, 0);
}

(self as any).onmessage = (ev: MessageEvent) => {
	const msg = ev.data;
	try {
		switch (msg && msg.type) {
			case 'init':
				if (typeof msg.seed === 'number') srand(msg.seed);
				if (msg.bounds) bounds = msg.bounds;
				if (typeof msg.simDtMs === 'number') simDtMs = msg.simDtMs;
				if (msg.state) {
					state = msg.state;
					try { normalizeStateShips(state); } catch (e) {}
				}
				postMessage({ type: 'ready' });
				break;
			case 'start':
				if (!state) { postMessage({ type: 'error', message: 'no state' }); break; }
				running = true; acc = 0; last = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now(); tick();
				break;
			case 'stop':
				running = false;
				break;
			case 'snapshotRequest':
				postSnapshot();
				break;
			case 'setSeed':
				if (typeof msg.seed === 'number') { srand(msg.seed); }
				break;
			case 'command':
				if (msg.cmd === 'spawnShip' && state) {
					try { normalizeTurrets(msg.args.ship); } catch (e) {}
					state.ships.push(msg.args.ship);
					try { (state as any).shipMap && (state as any).shipMap.set(msg.args.ship.id, msg.args.ship); } catch (e) {}
					try { const tt = String((msg.args.ship as any).team || ''); state.teamCounts[tt] = (state.teamCounts[tt] || 0) + 1; } catch (e) {}
				} else if (msg.cmd === 'spawnShipBullet' && state) {
					state.bullets.push(msg.args.bullet);
				} else if (msg.cmd === 'setState') {
					state = msg.args.state;
					try { normalizeStateShips(state); } catch (e) {}
				}
				break;
			default:
				// ignore
				break;
		}
	} catch (err: any) {
		const stack = err && (err as any).stack ? (err as any).stack : '';
		postMessage({ type: 'error', message: String(err), stack });
	}
};

export default null;
