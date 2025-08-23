// Minimal TypeScript shim that re-exports the existing JavaScript runtime implementation.
// Import the runtime as a namespace and re-export value bindings to avoid
// circular alias issues. Types are defined in `gamemanager.d.ts`.


// Ported from gamemanager.js, now canonical TypeScript implementation
import { makeInitialState, createShip } from './entities';
import { simulateStep, SIM_DT_MS } from './simulate';
import { srand, srandom } from './rng';
import { getDefaultBounds } from './config/displayConfig';
import { createSimWorker } from './createSimWorker';
import { SHIELD, HEALTH, EXPLOSION, STARS, FALLBACK_POSITIONS } from './config/gamemanagerConfig';
import type { ShipConfigMap } from './types';
import { setShipConfig, getShipConfig, getDefaultShipType } from './config/entitiesConfig';
import { chooseReinforcementsWithManagerSeed } from './config/teamsConfig';

export const ships: any[] = [];
export const bullets: any[] = [];
export const particles: any[] = [];
export const stars: any[] = [];
export const flashes: any[] = [];
export const shieldFlashes: any[] = [];
export const healthFlashes: any[] = [];
export const particlePool: any[] = [];

export const config = {
	shield: { ...SHIELD },
	health: { ...HEALTH },
	explosion: { ...EXPLOSION },
	stars: { ...STARS }
};

let _seed: number | null = null;
let _reinforcementInterval: number = 5.0;
let _reinforcementAccumulator = 0;
let _starCanvasVersion = 0;
let starCanvas: HTMLCanvasElement | null = null;
let _lastSimulateFrameId: number | null = null;
let _doubleSimStrict = false;

export function setDoubleSimStrict(v: boolean = false) { _doubleSimStrict = !!v; }

export class Particle {
	x: number; y: number; vx: number; vy: number; ttl: number; life: number; color: string; size: number; alive: boolean;
	constructor(x = 0, y = 0, vx = 0, vy = 0, ttl = 1, color = '#fff', size = 2) {
		this.x = x; this.y = y; this.vx = vx; this.vy = vy; this.ttl = ttl; this.life = ttl; this.color = color; this.size = size; this.alive = true;
	}
}

export function acquireParticle(x: number, y: number, opts: Partial<Particle> = {}): Particle {
	let p: Particle | null = null;
	if (particlePool.length) {
		p = particlePool.pop() as Particle;
		p.x = x; p.y = y; p.vx = opts.vx ?? 0; p.vy = opts.vy ?? 0; p.ttl = opts.ttl ?? 1; p.life = p.ttl; p.color = opts.color ?? '#fff'; p.size = opts.size ?? 2; p.alive = true;
	} else {
		p = new Particle(x, y, opts.vx ?? 0, opts.vy ?? 0, opts.ttl ?? 1, opts.color ?? '#fff', opts.size ?? 2);
	}
	particles.push(p);
	return p;
}

export function releaseParticle(p: Particle) {
	const i = particles.indexOf(p);
	if (i !== -1) particles.splice(i, 1);
	p.alive = false;
	particlePool.push(p);
}

export function reset(seedValue: number | null = null) {
	ships.length = 0; bullets.length = 0; particles.length = 0; stars.length = 0; flashes.length = 0; shieldFlashes.length = 0; healthFlashes.length = 0;
	_reinforcementAccumulator = 0;
	if (typeof seedValue === 'number') { _seed = seedValue >>> 0; srand(_seed); }
}

export function initStars(state: any, W = 800, H = 600, count = 140) {
	if (!state || !Array.isArray(state.stars)) return;
	state.stars.length = 0;
	for (let i = 0; i < count; i++) {
		const x = srandom() * W;
		const y = srandom() * H;
		const r = 0.3 + srandom() * 1.3;
		const a = 0.3 + srandom() * 0.7;
		const twPhase = srandom() * Math.PI * 2;
		const twSpeed = 0.5 + srandom() * 1.5;
		state.stars.push({ x, y, r, a, baseA: a, twPhase, twSpeed });
	}
}

export function createStarCanvas(state: any, W = 800, H = 600, bg = '#041018'): HTMLCanvasElement | null {
	if (!state || !Array.isArray(state.stars)) return null;
	try {
		const c = (typeof document !== 'undefined' && document.createElement) ? document.createElement('canvas') : null;
		if (!c) return null;
		c.width = Math.max(1, Math.floor(W)); c.height = Math.max(1, Math.floor(H));
		const ctx = c.getContext && c.getContext('2d');
		if (ctx) {
			ctx.fillStyle = bg; ctx.fillRect(0, 0, c.width, c.height);
			for (const s of state.stars) {
				const alpha = Math.max(0, Math.min(1, s.a != null ? s.a : (s.baseA != null ? s.baseA : 1)));
				ctx.beginPath(); ctx.fillStyle = `rgba(255,255,255,${alpha})`;
				const rr = Math.max(0.2, s.r || 0.5);
				ctx.arc(s.x || 0, s.y || 0, rr, 0, Math.PI * 2); ctx.fill();
			}
		}
		_starCanvasVersion = (_starCanvasVersion || 0) + 1; (c as any)._version = _starCanvasVersion; starCanvas = c; return c;
	} catch (e) { return null; }
}

export function getStarCanvasVersion() { return _starCanvasVersion; }

export function setReinforcementInterval(seconds: number) { _reinforcementInterval = Number(seconds) || 5.0; }
export function getReinforcementInterval() { return _reinforcementInterval; }

function emitManagerEvent(map: Map<string, Function[]>, type: string, data: any) {
	const arr = map.get(type) || [];
	for (const cb of arr.slice()) { try { if (typeof cb === 'function') cb(data); } catch (e) {} }
}

function evaluateReinforcement(dt: number, state: any, continuousOptions: any = {}): { spawned: any[] } | null {
	_reinforcementAccumulator += dt;
	if (_reinforcementAccumulator >= _reinforcementInterval) {
		_reinforcementAccumulator = 0;
		try {
					if (typeof chooseReinforcementsWithManagerSeed === 'function') {
						const orders = chooseReinforcementsWithManagerSeed(state, { ...continuousOptions, bounds: getDefaultBounds(), enabled: true });
						if (Array.isArray(orders) && orders.length) {
							const spawned: any[] = [];
							for (const o of orders) {
								try {
									const ship = createShip(o.type || getDefaultShipType(), o.x || 100, o.y || 100, o.team || 'red');
									state.ships.push(ship);
									spawned.push(ship);
								} catch (e) {}
							}
							return { spawned };
						}
					}
			const fallback = getDefaultShipType();
			const r = createShip(fallback, FALLBACK_POSITIONS[0].x, FALLBACK_POSITIONS[0].y, FALLBACK_POSITIONS[0].team);
			const b = createShip(fallback, FALLBACK_POSITIONS[1].x, FALLBACK_POSITIONS[1].y, FALLBACK_POSITIONS[1].team);
			state.ships.push(r); state.ships.push(b);
			return { spawned: [r, b] };
		} catch (e) { return null; }
	}
	return null;
}

export interface GameManagerOptions {
	useWorker?: boolean;
	renderer?: any;
	seed?: number;
	createSimWorker?: typeof createSimWorker;
}

export function createGameManager({ useWorker = true, renderer = null, seed = 12345, createSimWorker: createSimWorkerFactory }: GameManagerOptions = {}) {
	let state = makeInitialState();
	let running = false;
	const listeners = new Map<string, Function[]>();
	const workerReadyCbs: Function[] = [];
	let simWorker: any = null; let workerReady = false;
		let lastReinforcement: { spawned: any[]; timestamp: number; options: any } = { spawned: [], timestamp: 0, options: {} };
	let continuous = false; let continuousOptions: any = {};

	function emit(type: string, msg: any) { emitManagerEvent(listeners, type, msg); }
	function _mgr_random() { return srandom(); }

	try {
		if (useWorker) {
			const factory = createSimWorkerFactory || createSimWorker;
			simWorker = factory(new URL('./simWorker.js', import.meta.url).href);
			simWorker.on && simWorker.on('ready', () => { workerReady = true; for (const cb of workerReadyCbs.slice()) { try { cb(); } catch (e) {} } });
			simWorker.on && simWorker.on('snapshot', (m: any) => { if (m && m.state) state = m.state; });
			simWorker.on && simWorker.on('reinforcements', (m: any) => { emit('reinforcements', m); });
			try { simWorker.post({ type: 'init', seed, bounds: getDefaultBounds(), simDtMs: SIM_DT_MS, state }); simWorker.post({ type: 'start' }); } catch (e) {}
		}
	} catch (e) { simWorker = null; }

	function _evaluateAndEmit(dt: number) {
		const result = evaluateReinforcement(dt, state, continuousOptions);
			if (result && Array.isArray(result.spawned) && result.spawned.length) {
				lastReinforcement = { spawned: result.spawned, timestamp: Date.now(), options: { ...continuousOptions } };
				emit('reinforcements', { spawned: result.spawned });
			}
	}

	function step(dtSeconds: number) {
		if (!simWorker) {
			try { simulateStep(state, dtSeconds, getDefaultBounds()); } catch (e) {}
		} else {
			try { simWorker.post && simWorker.post({ type: 'snapshotRequest' }); } catch (e) {}
		}
		_evaluateAndEmit(dtSeconds);
		if (Array.isArray(state.explosions)) { for (const ex of state.explosions) { flashes.push({ ...ex }); } }
		if (Array.isArray(state.shieldHits)) { for (const h of state.shieldHits) { shieldFlashes.push({ ...h }); } state.shieldHits.length = 0; }
		if (Array.isArray(state.healthHits)) { for (const h of state.healthHits) { healthFlashes.push({ ...h }); } state.healthHits.length = 0; }
		function decay(arr: any[], dt: number) { for (let i = arr.length - 1; i >= 0; i--) { const it = arr[i]; it.life = (it.life || it.ttl || 0) - dt; if (it.life <= 0) arr.splice(i, 1); } }
		decay(flashes, dtSeconds); decay(shieldFlashes, dtSeconds); decay(healthFlashes, dtSeconds);
		if (renderer && typeof renderer.renderState === 'function') {
			try { renderer.renderState({ ships: state.ships, bullets: state.bullets, flashes, shieldFlashes, healthFlashes, t: state.t }); } catch (e) {}
		}
	}

	let last = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
	let acc = 0;
	function runLoop() {
		if (!running) return;
		const now = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
		acc += now - last; last = now;
		if (acc > 250) acc = 250;
		while (acc >= SIM_DT_MS) { step(SIM_DT_MS / 1000); acc -= SIM_DT_MS; }
		try { requestAnimationFrame(runLoop); } catch (e) { setTimeout(runLoop, SIM_DT_MS); }
	}

	function on(evt: string, cb: Function) { const arr = listeners.get(evt) || []; arr.push(cb); listeners.set(evt, arr); }
	function off(evt: string, cb: Function) { const arr = listeners.get(evt) || []; const i = arr.indexOf(cb); if (i !== -1) arr.splice(i, 1); }
	function start() { if (!running) { running = true; last = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now(); runLoop(); } }
	function pause() { running = false; }
	function resetManager() { state = makeInitialState(); if (simWorker) try { simWorker.post({ type: 'command', cmd: 'setState', args: { state } }); } catch (e) {} }
	function stepOnce(dt = SIM_DT_MS / 1000) { const n = Number(dt) || (SIM_DT_MS / 1000); step(n); }
	function setContinuousEnabled(v: boolean = false) {
		continuous = !!v;
		if (simWorker) {
			try { simWorker.post({ type: 'setContinuous', value: !!v }); } catch (e) {}
		} else {
			if (continuous) {
				const result = evaluateReinforcement(SIM_DT_MS / 1000, state, continuousOptions);
						if (result && Array.isArray(result.spawned) && result.spawned.length) {
							lastReinforcement = { spawned: result.spawned, timestamp: Date.now(), options: { ...continuousOptions } };
							emit('reinforcements', { spawned: result.spawned });
						}
			}
		}
	}
	function isContinuousEnabled() { return !!continuous; }
	function setContinuousOptions(opts: any = {}) { continuousOptions = { ...continuousOptions, ...opts }; if (simWorker) try { simWorker.post({ type: 'setContinuousOptions', opts: continuousOptions }); } catch (e) {} }
	function getContinuousOptions() { return { ...continuousOptions }; }
	function setReinforcementIntervalManager(seconds: number) { setReinforcementInterval(seconds); if (simWorker) try { simWorker.post({ type: 'setReinforcementInterval', seconds }); } catch (e) {} }
	function getReinforcementIntervalManager() { return getReinforcementInterval(); }
	function isRunning() { return running; }
	function isWorker() { return !!simWorker && !!workerReady; }
	function onWorkerReady(cb: Function) { if (typeof cb === 'function') workerReadyCbs.push(cb); }
	function offWorkerReady(cb: Function) { const i = workerReadyCbs.indexOf(cb); if (i !== -1) workerReadyCbs.splice(i, 1); }
	function spawnShip(team: string = 'red') {
		try {
			const type = getDefaultShipType();
			const b = getDefaultBounds();
			const x = Math.max(0, Math.min(b.W, srandom() * b.W));
			const y = Math.max(0, Math.min(b.H, srandom() * b.H));
			const ship = createShip(type, x, y, team);
			state.ships.push(ship);
			return ship;
		} catch (e) { return null; }
	}
	function reseedManager(newSeed: number = Math.floor(srandom() * 0xffffffff)) {
		_seed = newSeed >>> 0; srand(_seed);
		if (simWorker) try { simWorker.post({ type: 'setSeed', seed: _seed }); } catch (e) {}
	}
	function getLastReinforcement() { return { ...lastReinforcement }; }
	function snapshot() { return { ships: state.ships.slice(), bullets: state.bullets.slice(), t: state.t }; }
	const score = { red: 0, blue: 0 };
	const internal = { state, bounds: getDefaultBounds() };

	return {
		on,
		off,
		start,
		pause,
		reset: resetManager,
		stepOnce,
		setContinuousEnabled,
		isContinuousEnabled,
		setContinuousOptions,
		getContinuousOptions,
		setReinforcementInterval: setReinforcementIntervalManager,
		getReinforcementInterval: getReinforcementIntervalManager,
		isRunning,
		isWorker,
		onWorkerReady,
		offWorkerReady,
		spawnShip,
		reseed: reseedManager,
		getLastReinforcement,
		snapshot,
		score,
		_internal: internal
	};
}

export function simulate(dt: number, W = 800, H = 600) {
	try {
		const now = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
		const frame = Math.floor(now / 4);
		if (_lastSimulateFrameId === frame) {
			const msg = '[gamemanager] detected simulate() called multiple times in same frame';
			if (_doubleSimStrict) throw new Error(msg);
			else console.warn(msg);
		}
		_lastSimulateFrameId = frame;
	} catch (e) {}
	const state = { ships, bullets, particles, stars, explosions: [], shieldHits: [], healthHits: [] };
	evaluateReinforcement(dt, state);
	try { simulateStep(state, dt, { W, H }); } catch (e) {}
		for (const ex of state.explosions) {
			if (ex && typeof ex === 'object') flashes.push({ ...(ex as object) });
			try {
				const count = 12;
				for (let i = 0; i < count; i++) {
					const ang = srandom() * Math.PI * 2;
					const sp = 30 + srandom() * 90;
					acquireParticle((ex as any).x || 0, (ex as any).y || 0, { vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp, ttl: 0.6, color: 'rgba(255,200,100,0.95)', size: 3 });
				}
			} catch (e) {}
		}
		for (const h of state.shieldHits) { if (h && typeof h === 'object') shieldFlashes.push({ ...(h as object) }); }
		for (const h of state.healthHits) { if (h && typeof h === 'object') healthFlashes.push({ ...(h as object) }); }
	return { ships, bullets, particles, flashes, shieldFlashes, healthFlashes, stars, starCanvas };
}

export function processStateEvents(state: any, dt: number = 0) { return state; }

export default createGameManager;
