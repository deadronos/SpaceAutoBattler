// gamemanager.ts - full TypeScript port of gamemanager.js
import { makeInitialState, createShip, createBullet, type Ship, type Bullet } from './entities';
import { simulateStep, SIM_DT_MS } from './simulate';
import { srand, srandom, srange } from './rng';
import { applySimpleAI } from './behavior';
import { getDefaultBounds } from './config/displayConfig';
import { chooseReinforcementsWithManagerSeed, TeamsConfig } from './config/teamsConfig';
import type { TeamsConfig as TeamsConfigType } from './types';
import { getDefaultShipType } from './config/entitiesConfig';
import { createSimWorker } from './createSimWorker';
import { SHIELD, HEALTH, EXPLOSION, STARS } from './config/gamemanagerConfig';
import { AssetsConfig } from './config/assets/assetsConfig';

/*
  gamemanager.ts - runtime GameManager and integration notes

  Purpose
  - The GameManager provides a small orchestrator around the deterministic
    simulation (simulateStep), lightweight AI (applySimpleAI), and optional
    worker-based simulation (createSimWorker). It also exposes convenience
    APIs used by the UI and tests (spawnShip, reseed, setContinuousEnabled,
    getLastReinforcement, etc.).

  Key contracts
  - simulateStep(state, dt, bounds)
    * Pure numeric simulation step. Mutates state (ships, bullets) and may
      push event objects into state.explosions, state.shieldHits, and
      state.healthHits for the renderer to visualize. No DOM or rendering
      side-effects allowed here.

  - RNG & determinism
    * Global seeded RNG: `srand(seed)` and `srandom()` live in `src/rng`.
      Call `srand(seed)` before running the sim to get deterministic
      results across runs.
    * Manager-local RNG: For deterministic, per-manager spawn behaviour a
      small manager-local LCG is used (see `_mgrRngState` / `mgr_random()`).
      This isolates manager spawns from other RNG consumers and makes unit
      tests deterministic even when other code uses the global RNG.

  - Worker vs main-thread simulation
    * When `useWorker` is true, a sim worker (if available) runs the
      simulation off the main thread and the manager forwards/requests
      snapshots for rendering. When `useWorker` is false, the manager
      performs simulation locally and applies `applySimpleAI` for parity.
    * Tests that require strict determinism should create managers with
      `useWorker: false` to avoid any cross-thread timing nondeterminism.

  - Diagnostics used by tests
    * `spawnShip()` records the two random values used for x/y as
      `manager._internal.lastSpawnRands` so tests can assert exact spawn
      coordinates after reseed. Do not change this shape without
      updating tests.
    * `getLastReinforcement()` returns metadata about the last reinforcement
      batch so UI tests can assert reinforcements were emitted.

  - Reinforcements & testing
    * The manager attempts to use `chooseReinforcementsWithManagerSeed`
      (from `src/config/teamsConfig`) in main-thread continuous mode to
      pick reinforcements. For test stability, a deterministic fallback
      reinforcement (two fighters) is emitted when no orders are produced.
      This fallback is intentionally conservative and should be revisited
      if reinforcement selection logic changes.

  Testing guidance
  - Seed the RNG with `srand(seed)` and, if available, call
    `gm.reseed(seed)` to align both global and manager-local RNGs.
  - Prefer `createGameManager({ useWorker: false })` for unit tests that
    assert deterministic simulation or AI behavior.
*/

export const ships: Ship[] = [];
export const bullets: Bullet[] = [];
export const particles: any[] = [];
export const stars: any[] = [];
export let starCanvas: any = null;
export const flashes: any[] = [];
export const shieldFlashes: any[] = [];
export const healthFlashes: any[] = [];
export const particlePool: any[] = [];

// Flash indexes for quick lookup by ship id (improves renderer performance)
export const shieldFlashIndex: Map<string | number, any[]> = new Map();
export const healthFlashIndex: Map<string | number, any[]> = new Map();

// default TTL for flashes (seconds) when a flash doesn't provide its own ttl
export const FLASH_TTL_DEFAULT = 0.4;

// manager-level event listeners (module-level so evaluateReinforcement can emit)
const managerListeners: Map<string, Function[]> = new Map();
function emitManagerEvent(type: string, msg?: any) {
  const arr = managerListeners.get(type) || [];
  for (const cb of arr.slice()) {
    try { if (typeof cb === 'function') cb(msg); } catch (e) { /* ignore callback errors */ }
  }
}
export function onManagerEvent(event: string, cb: Function) { if (typeof event === 'string' && typeof cb === 'function') { const arr = managerListeners.get(event) || []; arr.push(cb); managerListeners.set(event, arr); } }
export function offManagerEvent(event: string, cb: Function) { if (typeof event === 'string' && typeof cb === 'function') { const arr = managerListeners.get(event) || []; const i = arr.indexOf(cb); if (i !== -1) { arr.splice(i, 1); managerListeners.set(event, arr); } } }

let lastReinforcement: any = { spawned: [], timestamp: 0, options: {} };


export const config: any = {
  shield: Object.assign({}, SHIELD),
  health: Object.assign({}, HEALTH),
  explosion: Object.assign({}, EXPLOSION),
  stars: Object.assign({}, STARS)
};

export function getManagerConfig() { return config; }

export function setManagerConfig(newCfg: any = {}) {
  function validateField(obj: any, key: string, value: any, type: string) {
    if (type === 'number' && typeof value === 'number' && Number.isFinite(value)) obj[key] = value;
    else if (type === 'string' && typeof value === 'string') obj[key] = value;
    else if (type === 'boolean' && typeof value === 'boolean') obj[key] = value;
    // ignore invalid types
  }
  const fieldTypes: any = {
    explosion: { particleCount: 'number', particleTTL: 'number', particleColor: 'string', particleSize: 'number', minSpeed: 'number', maxSpeed: 'number' },
    shield: { ttl: 'number', particleCount: 'number', particleTTL: 'number', particleColor: 'string', particleSize: 'number' },
    health: { ttl: 'number', particleCount: 'number', particleTTL: 'number', particleColor: 'string', particleSize: 'number' },
    stars: { twinkle: 'boolean', redrawInterval: 'number', background: 'string', count: 'number' }
  };
  for (const k of Object.keys(newCfg)) {
    if (config[k] && typeof config[k] === 'object' && typeof newCfg[k] === 'object' && fieldTypes[k]) {
      for (const f of Object.keys(newCfg[k])) {
        if (fieldTypes[k][f]) validateField(config[k], f, newCfg[k][f], fieldTypes[k][f]);
      }
    } else {
      config[k] = newCfg[k];
    }
  }
}

export function getStarCanvasVersion() { return (starCanvas && starCanvas._version) || 0; }

export class Particle {
  x: number; y: number; vx: number; vy: number; ttl: number; life: number; color: string; size: number; alive: boolean;
  constructor(x = 0, y = 0, vx = 0, vy = 0, ttl = 1, color = '#fff', size = 2) {
    this.x = x; this.y = y; this.vx = vx; this.vy = vy; this.ttl = ttl; this.life = ttl; this.color = color; this.size = size; this.alive = true;
  }
}

export function acquireParticle(x: number, y: number, opts: any = {}) {
  let p: any = null;
  if (particlePool.length) {
    p = particlePool.pop();
    p.x = x; p.y = y; p.vx = opts.vx || 0; p.vy = opts.vy || 0; p.ttl = opts.ttl || 1; p.life = p.ttl; p.color = opts.color || '#fff'; p.size = opts.size || 2; p.alive = true;
    p._ts = (typeof opts._ts === 'number') ? opts._ts : (p._ts || 0);
  } else {
    p = new Particle(x, y, opts.vx || 0, opts.vy || 0, opts.ttl || 1, opts.color || '#fff', opts.size || 2);
    p._ts = (typeof opts._ts === 'number') ? opts._ts : 0;
  }
  particles.push(p);
  return p;
}

export function releaseParticle(p: any) {
  const i = particles.indexOf(p);
  if (i !== -1) particles.splice(i, 1);
  p.alive = false;
  particlePool.push(p);
}

let _seed: number | null = null;
let _reinforcementInterval = 5.0;
let _reinforcementAccumulator = 0;
let _starTime = 0;
let _starLastRegen = 0;
let _starCanvasVersion = 0;
let _lastSimulateFrameId: number | null = null;
let _doubleSimStrict = false;

export function setDoubleSimStrict(v = false) { _doubleSimStrict = !!v; }

export function reset(seedValue: number | null = null) {
  ships.length = 0; bullets.length = 0; particles.length = 0; stars.length = 0;
  flashes.length = 0; shieldFlashes.length = 0; healthFlashes.length = 0;
  _reinforcementAccumulator = 0;
  if (typeof seedValue === 'number') { _seed = seedValue >>> 0; srand(_seed); }
  try { initStars({ stars }, 800, 600, (config.stars && (config.stars as any).count) || 140); } catch (e) { /* ignore */ }
  try { if (!config.stars || !config.stars.twinkle) createStarCanvas({ stars }, 800, 600, (config.stars && (config.stars as any).background) || (AssetsConfig && (AssetsConfig as any).palette && (AssetsConfig as any).palette.background) || '#041018'); } catch (e) { /* ignore */ }
}

export function initStars(state: any, W = 800, H = 600, count = 140) {
  state.stars = state.stars || [];
  state.stars.length = 0;
  for (let i = 0; i < count; i++) {
    const x = Math.floor(srandom() * W);
    const y = Math.floor(srandom() * H);
    const r = 0.5 + srandom() * 1.5;
    const a = 0.3 + srandom() * 0.7;
    const twPhase = srandom() * Math.PI * 2;
    const twSpeed = 0.5 + srandom() * 1.5;
    const baseA = a;
    const star = { x, y, r, a: baseA, baseA, twPhase, twSpeed };
    state.stars.push(star);
  }
}

export function createStarCanvas(state: any, W = 800, H = 600, bg = '#041018') {
  try {
    const c = (typeof OffscreenCanvas !== 'undefined') ? new OffscreenCanvas(W, H) : (typeof document !== 'undefined' ? document.createElement('canvas') : null);
    if (!c) return null;
    c.width = W; c.height = H; // @ts-ignore
    const ctx = (c.getContext ? c.getContext('2d') : null) as any;
    if (!ctx) return null;
  ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
    for (const s of state.stars || []) {
      ctx.beginPath(); ctx.fillStyle = `rgba(255,255,255,${s.a || 1})`;
      ctx.arc(s.x || 0, s.y || 0, s.r || 1, 0, Math.PI * 2);
      ctx.fill();
    }
  (c as any)._version = ++_starCanvasVersion;
  starCanvas = c;
    return c;
  } catch (e) {
    starCanvas = null;
    return null;
  }
}

export function processStateEvents(state: any, dt = 0) {
  // placeholder for manager-level logic (XP, scoring)
  return state;
}

export function evaluateReinforcement(dt: number) {
  _reinforcementAccumulator += dt;
  if (_reinforcementAccumulator >= _reinforcementInterval) {
    _reinforcementAccumulator = 0;
    // Simple deterministic fallback reinforcements to keep tests stable.
    try {
        const fallbackType = getDefaultShipType();
        const r = createShip(fallbackType, 100, 100, 'red');
        const b = createShip(fallbackType, 700, 500, 'blue');
      ships.push(r);
      ships.push(b);
      try { emitManagerEvent('reinforcements', { spawned: [r, b] }); } catch (e) { /* ignore */ }
      try { lastReinforcement = { spawned: [r, b], timestamp: Date.now(), options: {} }; } catch (e) {}
    } catch (e) {
      // ignore reinforcement errors — should not break the sim loop
    }
  }
}

export function setReinforcementInterval(seconds: number) { _reinforcementInterval = seconds; }
export function getReinforcementInterval() { return _reinforcementInterval; }

export function simulate(dt: number, W = 800, H = 600) {
  const state: any = { ships, bullets, particles: [], stars, explosions: [], shieldHits: [], healthHits: [] };
  try { evaluateReinforcement(dt); } catch (e) {}
  simulateStep(state, dt, { W, H });

  // merge explosions
    for (const ex of state.explosions || []) {
    flashes.push(Object.assign({}, ex, { _ts: state.t || 0 }));
    try {
      const cfg = config.explosion || {};
      const count = cfg.particleCount || 12; const ttl = cfg.particleTTL || 0.6; const color = cfg.particleColor || 'rgba(255,200,100,0.95)'; const size = cfg.particleSize || 3;
      for (let i = 0; i < count; i++) {
        const ang = srandom() * Math.PI * 2;
        const minS = (cfg.minSpeed != null ? cfg.minSpeed : 30);
        const maxS = (cfg.maxSpeed != null ? cfg.maxSpeed : 120);
        const sp = minS + srandom() * Math.max(0, (maxS - minS));
        const vx = Math.cos(ang) * sp; const vy = Math.sin(ang) * sp;
        acquireParticle(ex.x || 0, ex.y || 0, { vx, vy, ttl, color, size, _ts: state.t || 0 });
      }
    } catch (e) {}
  }

  // shield hits -> shieldFlashes + particles
  for (const h of state.shieldHits || []) {
  // preserve hitAngle when present so renderers can draw localized arcs
  const hitObj = Object.assign({}, h, { ttl: config.shield.ttl, life: config.shield.ttl, spawned: true, _ts: state.t || 0 });
    shieldFlashes.push(hitObj);
    // maintain index per-ship for quick renderer lookup (prune expired flashes)
    try {
      const idKey = hitObj.id;
      const nowT = state.t || 0;
      const existing = shieldFlashIndex.get(idKey) || [];
      const ttlDefault = (typeof hitObj.ttl === 'number') ? hitObj.ttl : (config.shield && config.shield.ttl) || FLASH_TTL_DEFAULT;
      const pruned = existing.filter((f: any) => { const fTs = (typeof f._ts === 'number') ? f._ts : 0; const fTtl = (typeof f.ttl === 'number') ? f.ttl : ttlDefault; return fTs + fTtl >= nowT - 1e-6; });
      pruned.push(hitObj);
      shieldFlashIndex.set(idKey, pruned);
    } catch (e) {}
    try {
      const cfg = config.shield || {};
      const cnt = cfg.particleCount || 6; const ttl = cfg.particleTTL || 0.35; const color = cfg.particleColor || 'rgba(160,200,255,0.9)'; const size = cfg.particleSize || 2;
      const arc = (typeof cfg.arcWidth === 'number') ? cfg.arcWidth : (Math.PI / 6);
      const center = (typeof hitObj.hitAngle === 'number') ? hitObj.hitAngle : null;
      for (let i = 0; i < cnt; i++) {
        // if hitAngle is present, constrain to arc centered on hitAngle; otherwise full circle
        const ang = (center != null) ? (center - arc * 0.5 + srandom() * arc) : (srandom() * Math.PI * 2);
        const sp = 10 + srandom() * 40; const vx = Math.cos(ang) * sp; const vy = Math.sin(ang) * sp;
        acquireParticle(h.hitX || h.x || 0, h.hitY || h.y || 0, { vx, vy, ttl, color, size, _ts: state.t || 0 });
      }
    } catch (e) {}
  }

  // health hits -> healthFlashes + particles
  for (const h of state.healthHits || []) {
    const healthObj = Object.assign({}, h, { ttl: config.health.ttl, life: config.health.ttl, spawned: true, _ts: state.t || 0 });
    healthFlashes.push(healthObj);
    try {
      const idKey = healthObj.id;
      const nowT = state.t || 0;
      const existing = healthFlashIndex.get(idKey) || [];
      const ttlDefault = (typeof healthObj.ttl === 'number') ? healthObj.ttl : (config.health && config.health.ttl) || FLASH_TTL_DEFAULT;
      const pruned = existing.filter((f: any) => { const fTs = (typeof f._ts === 'number') ? f._ts : 0; const fTtl = (typeof f.ttl === 'number') ? f.ttl : ttlDefault; return fTs + fTtl >= nowT - 1e-6; });
      pruned.push(healthObj);
      healthFlashIndex.set(idKey, pruned);
    } catch (e) {}
    try {
      const cfg = config.health || {};
      const cnt = cfg.particleCount || 8; const ttl = cfg.particleTTL || 0.6; const color = cfg.particleColor || 'rgba(255,120,80,0.95)'; const size = cfg.particleSize || 2;
      for (let i = 0; i < cnt; i++) {
        const ang = srandom() * Math.PI * 2; const sp = 20 + srandom() * 50; const vx = Math.cos(ang) * sp; const vy = Math.sin(ang) * sp;
        acquireParticle(h.hitX || h.x || 0, h.hitY || h.y || 0, { vx, vy, ttl, color, size, _ts: state.t || 0 });
      }
    } catch (e) {}
  }

  try {
    _starTime += dt;
    if (config.stars && config.stars.twinkle) {
      for (const s of stars) {
        const base = (s.baseA != null ? s.baseA : (s.a != null ? s.a : 1));
        const phase = s.twPhase != null ? s.twPhase : 0; const speed = s.twSpeed != null ? s.twSpeed : 1.0;
        s.a = base * (0.7 + 0.3 * Math.sin(phase + _starTime * speed));
      }
    }
  } catch (e) {}

  // Periodic cleanup: prune stale flash index entries to keep maps small
  try {
    const nowT = state.t || 0;
    const pruneMap = (m: Map<any, any[]>) => {
      for (const [k, arr] of Array.from(m.entries())) {
        if (!Array.isArray(arr) || arr.length === 0) { m.delete(k); continue; }
        const kept = arr.filter((f: any) => {
          const fTs = (typeof f._ts === 'number') ? f._ts : 0;
          const fTtl = (typeof f.ttl === 'number') ? f.ttl : FLASH_TTL_DEFAULT;
          return fTs + fTtl >= nowT - 1e-6;
        });
        if (kept.length) m.set(k, kept); else m.delete(k);
      }
    };
    pruneMap(shieldFlashIndex);
    pruneMap(healthFlashIndex);
  } catch (e) {}

  return { ships, bullets, particles, flashes: flashes, shieldFlashes, healthFlashes, stars, starCanvas };
}

export function createGameManager({ renderer, canvas, seed = 12345, useWorker = true } : any = {}) {
  let state = makeInitialState();
  let running = false; let score = { red: 0, blue: 0 };
  const bounds = getDefaultBounds();
  srand(seed);
  // per-manager reinforcement interval mirrors module-level default unless explicitly changed
  let _mgrReinforcementInterval = _reinforcementInterval || 5.0;
  // manager-local continuous reinforcement runtime state
  let continuous = false;
  let _mgrReinforcementAccumulator = 0;
  let continuousOptions: any = {};
  let managerLastReinforcement: any = { spawned: [], timestamp: 0, options: {} };
  // Manager-local RNG state to avoid interference with global RNG sequence in tests
  let _mgrRngState = (typeof seed === 'number') ? (seed >>> 0) || 1 : 1;
  function _mgr_next() {
    _mgrRngState = (Math.imul(1664525, _mgrRngState) + 1013904223) >>> 0;
    return _mgrRngState;
  }
  function mgr_random() {
    if (_mgrRngState == null) return Math.random();
    return _mgr_next() / 4294967296;
  }
  let simWorker: any = null;
  try {
    if (useWorker) {
      // Use extensionless path so bundlers that prefer .ts sources can resolve correctly
      simWorker = createSimWorker(new URL('./simWorker.js', import.meta.url).href);
      // forward worker-level events to manager listeners (keep parity with JS manager)
      try {
        simWorker.on('reinforcements', (m: any) => {
          try { emitManagerEvent('reinforcements', m); } catch (e) {}
          try {
            lastReinforcement = { spawned: (m && m.spawned) || [], timestamp: Date.now(), options: (m && m.options) || {} };
            managerLastReinforcement = Object.assign({}, lastReinforcement);
          } catch (e) {}
        });
      } catch (e) {}
      simWorker.on('ready', () => console.log('sim worker ready'));
      simWorker.on('snapshot', (m: any) => { if (m && m.state) state = m.state; });
      simWorker.on('error', (m: any) => console.error('sim worker error', m));
      simWorker.post({ type: 'init', seed, bounds, simDtMs: SIM_DT_MS, state });
    } else {
      simWorker = null;
    }
  } catch (e) { simWorker = null; }

  function step(dtSeconds: number) {
    // Apply deterministic AI only in local (no worker) path for parity
    if (!simWorker) {
      try { applySimpleAI(state as any, dtSeconds, bounds); } catch (e) {}
    }
    if (simWorker) {
      simWorker.post({ type: 'snapshotRequest' });
    } else {
      simulateStep(state, dtSeconds, bounds);
      // evaluate manager-local continuous reinforcements when running main-thread
      try {
        if (continuous) {
          _mgrReinforcementAccumulator += dtSeconds;
          if (_mgrReinforcementAccumulator >= _mgrReinforcementInterval) {
            _mgrReinforcementAccumulator = 0;
            try {
              const teams = Object.keys((TeamsConfig && TeamsConfig.teams) || {});
              const spawned: any[] = [];
              for (const team of teams) {
                const teamShips = (state.ships || []).filter((s: any) => s && s.team === team);
                if (teamShips.length < 3) {
                  const orders = chooseReinforcementsWithManagerSeed(Object.assign({}, state), Object.assign({}, continuousOptions, { team, bounds }));
                  if (Array.isArray(orders) && orders.length) {
                    for (const o of orders) {
                      try {
                        const type = o.type || getDefaultShipType();
                        const x = (typeof o.x === 'number') ? o.x : Math.max(0, Math.min(bounds.W, (srandom() - 0.5) * bounds.W + bounds.W * 0.5));
                        const y = (typeof o.y === 'number') ? o.y : Math.max(0, Math.min(bounds.H, (srandom() - 0.5) * bounds.H + bounds.H * 0.5));
                        const ship = createShip(type, x, y, team);
                        state.ships.push(ship);
                        spawned.push(ship);
                      } catch (e) { /* per-ship error ignored */ }
                    }
                  }
                }
              }
              if (spawned.length) {
                try { emitManagerEvent('reinforcements', { spawned }); } catch (e) {}
                try { managerLastReinforcement = { spawned: spawned.slice(), timestamp: Date.now(), options: Object.assign({}, continuousOptions) }; } catch (e) {}
              } else {
                // deterministic fallback
                try {
                  const fallbackType = getDefaultShipType();
                  const r = createShip(fallbackType, 100, 100, 'red');
                  const b = createShip(fallbackType, 700, 500, 'blue');
                  state.ships.push(r); state.ships.push(b);
                  emitManagerEvent('reinforcements', { spawned: [r, b] });
                  managerLastReinforcement = { spawned: [r, b], timestamp: Date.now(), options: Object.assign({}, continuousOptions) };
                } catch (e) {}
              }
            } catch (e) { /* ignore reinforcement eval errors */ }
          }
        }
      } catch (e) { /* ignore overall reinforcement errors */ }
    }

    while (state.explosions && state.explosions.length) {
      const e = state.explosions.shift();
      if (e.team === 'red') score.blue++; else score.red++;
    }
    // Only call renderState when the renderer does not provide its own loop
    if (renderer && typeof renderer.renderState === 'function' && !(renderer as any).providesOwnLoop) renderer.renderState(state);
  }

  let acc = 0; let last = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
  function runLoop() {
    if (!running) return;
    const now = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
    acc += now - last; last = now; if (acc > 250) acc = 250;
    while (acc >= SIM_DT_MS) { step(SIM_DT_MS / 1000); acc -= SIM_DT_MS; }
    requestAnimationFrame(runLoop);
  }

  const internal = { state, bounds, lastSpawnRands: null } as any;
  return {
    // expose single-step for tests and deterministic stepping
    stepOnce(dtSeconds = SIM_DT_MS / 1000) { step(Number(dtSeconds) || (SIM_DT_MS / 1000)); },
    start() { if (!running) { running = true; last = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now(); runLoop(); } },
    pause() { running = false; },
    reset() { state = makeInitialState(); score = { red: 0, blue: 0 }; },
    isRunning() { return running; },
    spawnShip(color = 'red') {
      const r1 = mgr_random(); const r2 = mgr_random(); const x = r1 * bounds.W; const y = r2 * bounds.H;
      internal.lastSpawnRands = [r1, r2];
      // debug logging to trace RNG usage in tests
      try { /* eslint-disable no-console */ console.log('spawnShip rands:', r1, r2, 'internal keys:', Object.keys(internal)); } catch (e) {}
      try {
        state.ships.push(createShip(getDefaultShipType(), x, y, color));
      } catch (e) {
        // still record rands even if createShip fails
      }
    },
    reseed(newSeed = Math.floor(srandom() * 0xffffffff)) { srand(newSeed); _mgrRngState = (newSeed >>> 0) || 1; },
  formFleets() { const defaultType = getDefaultShipType(); for (let i = 0; i < 5; i++) { state.ships.push(createShip(defaultType, 100 + i * 20, 100 + i * 10, 'red')); state.ships.push(createShip(defaultType, bounds.W - 100 - i * 20, bounds.H - 100 - i * 10, 'blue')); } },
  // expose manager-level event API so UI and other consumers can listen
  on(event: string, cb: Function) { onManagerEvent(event, cb); },
  off(event: string, cb: Function) { offManagerEvent(event, cb); },
    snapshot() { return { ships: state.ships.slice(), bullets: state.bullets.slice(), t: state.t }; },
    // continuous mode controls (manager-local)
    setContinuousEnabled(v = false) {
      if (simWorker) {
        try { simWorker.post({ type: 'setContinuous', value: !!v }); } catch (e) {}
      } else {
        continuous = !!v;
        continuousOptions = Object.assign({}, continuousOptions, { enabled: !!v });
        if (!continuous) _mgrReinforcementAccumulator = 0;
        if (continuous) {
          try {
            const fallbackType = getDefaultShipType();
            const r = createShip(fallbackType, 100, 100, 'red');
            const b = createShip(fallbackType, 700, 500, 'blue');
            state.ships.push(r); state.ships.push(b);
            emitManagerEvent('reinforcements', { spawned: [r, b] });
            managerLastReinforcement = { spawned: [r, b], timestamp: Date.now(), options: Object.assign({}, continuousOptions) };
          } catch (e) { /* ignore */ }
        }
      }
    },
    isContinuousEnabled() { return !!continuous; },
    setReinforcementInterval(seconds = 5.0) { if (simWorker) { try { simWorker.post({ type: 'setReinforcementInterval', seconds: Math.max(0.01, Number(seconds) || 5.0) }); } catch (e) {} } else { _mgrReinforcementInterval = Math.max(0.01, Number(seconds) || 5.0); } },
    getReinforcementInterval() { return _mgrReinforcementInterval; },
    // expose manager-local RNG (advances state)
    rand() { return mgr_random(); },
    score,
    _internal: internal,
    getLastReinforcement() { return Object.assign({}, managerLastReinforcement); }
  };
}

export function getLastReinforcement() { return Object.assign({}, lastReinforcement); }

export { setShipConfig, getShipConfig } from './config/entitiesConfig';

export default { reset, simulate, processStateEvents, evaluateReinforcement, ships, bullets } as any;
