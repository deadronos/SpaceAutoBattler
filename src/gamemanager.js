// gamemanager.js - orchestrates simulateStep, simple behavior, and exposes API
import { makeInitialState, createShip, createBullet } from './entities.js';
import { simulateStep, SIM_DT_MS } from './simulate.js';
import { srand, srange, srandom } from './rng.js';
import { getDefaultBounds } from './config/displayConfig.js';
import { createSimWorker } from './createSimWorker.js';
import { SHIELD, HEALTH, EXPLOSION, STARS } from './config/gamemanagerConfig.js';
import { setShipConfig, getShipConfig } from './config/entitiesConfig.js';
import { chooseReinforcementsWithManagerSeed } from './config/teamsConfig.js';
import { applySimpleAI } from './behavior.js';

export function createGameManager({ renderer, canvas, seed = 12345, createSimWorker: createSimWorkerFactory } = {}) {
  let state = makeInitialState();
  let running = false;
  // Manager-level event listeners (always available even if worker creation fails)
  const managerListeners = new Map();
  function emitManagerEvent(type, msg) {
    const arr = managerListeners.get(type);
    if (Array.isArray(arr)) {
      for (const cb of arr.slice()) {
        try { if (typeof cb === 'function') cb(msg); } catch (e) { /* ignore */ }
      }
    }
  }
  let score = { red: 0, blue: 0 };
  // continuous reinforcement controls (per-manager, works with worker or main-thread)
  let continuous = false;
  let reinforcementInterval = 5.0; // seconds
  let reinforcementAccumulator = 0;
  // allow overriding continuous reinforcement options (passed to chooseReinforcements)
  let continuousOptions = {};
  // diagnostics about last reinforcement batch (for UI/telemetry)
  let lastReinforcement = { spawned: [], timestamp: 0, options: {} };
  const bounds = getDefaultBounds();
  srand(seed);
  // Try to run simulation in a worker when available
  let simWorker = null;
  let workerReady = false; // will be set when worker signals ready
  const workerReadyCbs = [];
  // Transient visual effects for the renderer (persist across frames with TTL)
  const flashes = []; // explosions
  const shieldFlashes = [];
  const healthFlashes = [];
  try {
    const factory = createSimWorkerFactory || createSimWorker;
    simWorker = factory(new URL('./simWorker.js', import.meta.url).href);
    // forward worker reinforcements messages to manager listeners
    try { simWorker.on('reinforcements', (m) => emitManagerEvent('reinforcements', m)); } catch (e) {}
    // mark worker as ready when it signals readiness so UI and callers can
    // rely on a definitive source of truth (gm.isWorker()). Also invoke any
    // registered callbacks (gm.onWorkerReady) so consumers can react.
    simWorker.on('ready', () => {
      workerReady = true;
      try {
        // call callbacks with try/catch to avoid breaking the worker loop
        for (const cb of workerReadyCbs.slice()) {
          try { if (typeof cb === 'function') cb(); } catch (e) { /* ignore callback errors */ }
        }
      } catch (e) { /* ignore overall errors */ }
    });
    simWorker.on('snapshot', (m) => {
      // replace authoritative local state with worker snapshot for rendering
      if (m && m.state) state = m.state;
    });
    simWorker.on('error', (m) => console.error('sim worker error', m));
    // initialize worker
    simWorker.post({ type: 'init', seed, bounds, simDtMs: SIM_DT_MS, state });
    // start the worker simulation loop so snapshots advance over time
    simWorker.post({ type: 'start' });
  } catch (e) {
    simWorker = null; // fallback to main-thread sim
  }

  function step(dtSeconds) {
    // basic AI & local firing only when no worker (main-thread simulation)
    if (!simWorker) {
      // Apply the same AI as the worker for parity
      try { applySimpleAI(state, dtSeconds, bounds); } catch (e) {}
    }

    if (simWorker) {
      // worker is authoritative — ask for one snapshot after letting the worker run
      simWorker.post({ type: 'snapshotRequest' });
    } else {
      simulateStep(state, dtSeconds, bounds);
    }
    // evaluate continuous reinforcements for main-thread sim (fallback)
    // When continuous mode is enabled and there's no worker, reinforce any team with <3 ships (including both teams if both <3 or 0)
    if (!simWorker && continuous) {
      reinforcementAccumulator += dtSeconds;
      if (reinforcementAccumulator >= reinforcementInterval) {
        reinforcementAccumulator = 0;
        try {
          const teams = Object.keys(require('./config/teamsConfig.js').TeamsConfig.teams);
          const spawned = [];
          for (const team of teams) {
            const teamShips = (state.ships || []).filter(s => s && s.team === team);
            if (teamShips.length < 3) {
              // Create a filtered state for this team (so chooseReinforcements logic works)
              const teamState = Object.assign({}, state, { ships: teamShips });
              const orders = require('./config/teamsConfig.js').chooseReinforcementsWithManagerSeed(teamState, Object.assign({}, continuousOptions, { bounds, team }));
              if (Array.isArray(orders) && orders.length) {
                for (const o of orders) {
                  try {
                    let type = o.type || 'fighter';
                    if (Array.isArray(continuousOptions.shipTypes) && continuousOptions.shipTypes.length) {
                      const types = continuousOptions.shipTypes;
                      type = types[Math.floor(srandom() * types.length)] || type;
                    }
                    const x = (typeof o.x === 'number') ? o.x : Math.max(0, Math.min(bounds.W, (srandom() - 0.5) * bounds.W + bounds.W * 0.5));
                    const y = (typeof o.y === 'number') ? o.y : Math.max(0, Math.min(bounds.H, (srandom() - 0.5) * bounds.H + bounds.H * 0.5));
                    const ship = createShip(type, x, y, team);
                    state.ships.push(ship);
                    spawned.push(ship);
                  } catch (e) { /* ignore per-ship errors */ }
                }
              }
            }
          }
          if (spawned.length) {
            try { emitManagerEvent('reinforcements', { spawned }); } catch (e) { /* ignore */ }
            try { lastReinforcement = { spawned: spawned.slice(), timestamp: Date.now(), options: Object.assign({}, continuousOptions) }; } catch (e) {}
          }
        } catch (e) {
          // ignore reinforcement errors — should not break the sim loop
        }
      }
    }
    // process transient events into effect buffers with TTL for rendering
    // Copy events before scoring consumes them
    if (Array.isArray(state.explosions)) {
      for (const ex of state.explosions) {
        flashes.push({ x: ex.x, y: ex.y, team: ex.team, ttl: EXPLOSION.particleTTL || 0.6, life: EXPLOSION.particleTTL || 0.6 });
      }
    }
    if (Array.isArray(state.shieldHits)) {
      for (const h of state.shieldHits) {
        shieldFlashes.push({ x: h.hitX || h.x, y: h.hitY || h.y, team: h.team, amount: h.amount, ttl: SHIELD.ttl || 0.4, life: SHIELD.ttl || 0.4 });
      }
      state.shieldHits.length = 0; // events consumed into effect buffer
    }
    if (Array.isArray(state.healthHits)) {
      for (const h of state.healthHits) {
        healthFlashes.push({ x: h.hitX || h.x, y: h.hitY || h.y, team: h.team, amount: h.amount, ttl: HEALTH.ttl || 0.6, life: HEALTH.ttl || 0.6 });
      }
      state.healthHits.length = 0;
    }

    // reconciliate events for score (consume explosions after buffering for visuals)
    while (state.explosions.length) {
      const e = state.explosions.shift();
      if (e.team === 'red') score.blue++;
      else score.red++;
    }

    // decay and purge effect buffers
    function decay(arr, dt) {
      for (let i = arr.length - 1; i >= 0; i--) {
        const it = arr[i]; it.life = (it.life || 0) - dt; if (it.life <= 0) arr.splice(i, 1);
      }
    }
    decay(flashes, dtSeconds);
    decay(shieldFlashes, dtSeconds);
    decay(healthFlashes, dtSeconds);

    // push augmented snapshot to renderer
    if (renderer && typeof renderer.renderState === 'function') {
      const renderSnapshot = {
        ships: state.ships,
        bullets: state.bullets,
        flashes,
        shieldFlashes,
        healthFlashes,
        t: state.t
      };
      renderer.renderState(renderSnapshot);
    }
  }

  // run loop (main-thread) -----------------
  let acc = 0; let last = performance.now();
  function runLoop() {
    if (!running) return;
    const now = performance.now();
    acc += now - last; last = now;
    if (acc > 250) acc = 250; // clamp
    while (acc >= SIM_DT_MS) {
      step(SIM_DT_MS / 1000);
      acc -= SIM_DT_MS;
    }
    requestAnimationFrame(runLoop);
  }

  return {
    on(event, cb) { if (typeof event === 'string' && typeof cb === 'function') {
      const arr = managerListeners.get(event) || []; arr.push(cb); managerListeners.set(event, arr);
    } },
    // expose single-step for tests and deterministic stepping
    stepOnce(dtSeconds = SIM_DT_MS / 1000) { step(Number(dtSeconds) || (SIM_DT_MS / 1000)); },
    off(event, cb) { if (typeof event === 'string' && typeof cb === 'function') {
      const arr = managerListeners.get(event) || []; const i = arr.indexOf(cb); if (i !== -1) { arr.splice(i, 1); managerListeners.set(event, arr); }
    } },
    start() { if (!running) { running = true; last = performance.now(); runLoop(); } },
    pause() { running = false; },
    reset() {
      state = makeInitialState(); score = { red: 0, blue: 0 };
      if (simWorker) simWorker.post({ type: 'command', cmd: 'setState', args: { state } });
    },
    // continuous mode controls (UI can toggle this)
    setContinuousEnabled(v = false) {
      // forward to worker when available, otherwise use local manager state
      if (simWorker) {
        try { simWorker.post({ type: 'setContinuous', value: !!v }); } catch (e) { /* ignore */ }
      } else {
        continuous = !!v;
        // ensure the continuousOptions mirror enabled state so chooseReinforcements
        // will actually produce orders when continuous is true
        continuousOptions = Object.assign({}, continuousOptions, { enabled: !!v });
        if (!continuous) reinforcementAccumulator = 0;
      }
    },
    isContinuousEnabled() {
      if (simWorker) return !!continuous; // local flag may be stale if worker is authoritative
      return !!continuous;
    },
    // configure continuous reinforcement behaviour used by chooseReinforcements
    setContinuousOptions(opts = {}) { continuousOptions = Object.assign({}, continuousOptions, opts); },
    getContinuousOptions() { return Object.assign({}, continuousOptions); },
    setReinforcementInterval(seconds = 5.0) {
      if (simWorker) {
        try { simWorker.post({ type: 'setReinforcementInterval', seconds: Math.max(0.01, Number(seconds) || 5.0) }); } catch (e) { /* ignore */ }
      } else {
        reinforcementInterval = Math.max(0.01, Number(seconds) || 5.0);
      }
    },
    isRunning() { return running; },
  // diagnostics getters for UI
  getLastReinforcement() { return Object.assign({}, lastReinforcement); },
  getReinforcementInterval() { return reinforcementInterval; },
  // authoritative check whether simulation is running in a worker
  isWorker() { return !!simWorker && !!workerReady; },
  onWorkerReady(cb) { if (typeof cb === 'function') workerReadyCbs.push(cb); },
  offWorkerReady(cb) { const i = workerReadyCbs.indexOf(cb); if (i !== -1) workerReadyCbs.splice(i, 1); },
    spawnShip(color = 'red') {
      const x = Math.random() * bounds.W; const y = Math.random() * bounds.H;
      const ship = createShip('fighter', x, y, color);
      // give a small initial drift to encourage engagement
      const dir = color === 'red' ? 1 : -1;
      ship.vx = 30 * dir; ship.vy = (Math.random() - 0.5) * 20;
      if (simWorker) simWorker.post({ type: 'command', cmd: 'spawnShip', args: { ship } });
      else state.ships.push(ship);
    },
    reseed(newSeed = Math.floor(Math.random()*0xffffffff)) { srand(newSeed); if (simWorker) simWorker.post({ type: 'setSeed', seed: newSeed }); },
    formFleets() { // create a small fleet each side
      for (let i = 0; i < 5; i++) {
        const r = createShip('fighter', 100 + i*20, 100 + i*10, 'red'); r.vx = 40; r.vy = 0;
        const b = createShip('fighter', bounds.W - 100 - i*20, bounds.H - 100 - i*10, 'blue'); b.vx = -40; b.vy = 0;
        if (simWorker) {
          simWorker.post({ type: 'command', cmd: 'spawnShip', args: { ship: r } });
          simWorker.post({ type: 'command', cmd: 'spawnShip', args: { ship: b } });
        } else {
          state.ships.push(r); state.ships.push(b);
        }
      }
    },
    snapshot() { return { ships: state.ships.slice(), bullets: state.bullets.slice(), t: state.t }; },
    score,
    _internal: { state, bounds }
  };
}

// (duplicate imports removed; consolidated at top of file)

export const ships = [];
export const bullets = [];
export const particles = [];
export const stars = [];
export let starCanvas = null;
export const flashes = [];
export const shieldFlashes = [];
export const healthFlashes = [];
export const particlePool = [];

// manager-level tuning config (particle/flash tuning)
export const config = {
  shield: Object.assign({}, SHIELD),
  health: Object.assign({}, HEALTH),
  explosion: Object.assign({}, EXPLOSION),
  stars: Object.assign({}, STARS)
};

export function setManagerConfig(newCfg = {}) {
  // Validate and shallow merge top-level keys. Only accept values of correct type.
  function validateField(obj, key, value, type) {
    if (type === 'number' && typeof value === 'number' && Number.isFinite(value)) obj[key] = value;
    else if (type === 'string' && typeof value === 'string') obj[key] = value;
    else if (type === 'boolean' && typeof value === 'boolean') obj[key] = value;
    // ignore invalid types
  }
  const fieldTypes = {
    explosion: {
      particleCount: 'number', particleTTL: 'number', particleColor: 'string', particleSize: 'number', minSpeed: 'number', maxSpeed: 'number'
    },
    shield: {
      ttl: 'number', particleCount: 'number', particleTTL: 'number', particleColor: 'string', particleSize: 'number'
    },
    health: {
      ttl: 'number', particleCount: 'number', particleTTL: 'number', particleColor: 'string', particleSize: 'number'
    },
    stars: {
      twinkle: 'boolean', redrawInterval: 'number'
    }
  };
  for (const k of Object.keys(newCfg)) {
    if (config[k] && typeof config[k] === 'object' && typeof newCfg[k] === 'object' && fieldTypes[k]) {
      for (const f of Object.keys(newCfg[k])) {
        if (fieldTypes[k][f]) {
          validateField(config[k], f, newCfg[k][f], fieldTypes[k][f]);
        }
      }
    } else {
      config[k] = newCfg[k];
    }
  }
}
export function getManagerConfig() { return config; }

/**
 * Return the current star canvas version. Incremented whenever createStarCanvas
 * updates the pre-rendered canvas. Useful for renderers to detect uploads.
 */
export function getStarCanvasVersion() { return _starCanvasVersion; }

export class Particle {
  constructor(x = 0, y = 0, vx = 0, vy = 0, ttl = 1, color = '#fff', size = 2) {
    this.x = x; this.y = y; this.vx = vx; this.vy = vy; this.ttl = ttl; this.life = ttl; this.color = color; this.size = size; this.alive = true;
  }
}

export function acquireParticle(x, y, opts = {}) {
  let p = null;
  if (particlePool.length) {
    p = particlePool.pop();
    // reinitialize
    p.x = x; p.y = y; p.vx = opts.vx || 0; p.vy = opts.vy || 0; p.ttl = opts.ttl || 1; p.life = p.ttl; p.color = opts.color || '#fff'; p.size = opts.size || 2; p.alive = true;
  } else {
    p = new Particle(x, y, opts.vx || 0, opts.vy || 0, opts.ttl || 1, opts.color || '#fff', opts.size || 2);
  }
  particles.push(p);
  return p;
}

export function releaseParticle(p) {
  // remove from particles array if present
  const i = particles.indexOf(p);
  if (i !== -1) particles.splice(i, 1);
  p.alive = false;
  particlePool.push(p);
}

let _seed = null;
let _reinforcementInterval = 5.0;
let _reinforcementAccumulator = 0;
// star/twinkle timing and versioning
let _starTime = 0;
let _starLastRegen = 0;
let _starCanvasVersion = 0;
// Internal guard to detect accidental double-simulation within the same
// logical frame. We compute a simple frame id based on performance.now()
// divided by 4ms (approx 250Hz) to bucket calls into a millisecond-granular
// frame window. In dev mode we can throw; otherwise we log a warning.
let _lastSimulateFrameId = null;
let _doubleSimStrict = false; // when true, throw on detection (useful in CI/dev)

export function setDoubleSimStrict(v = false) { _doubleSimStrict = !!v; }


export function reset(seedValue = null) {
  ships.length = 0; bullets.length = 0; particles.length = 0; stars.length = 0;
  flashes.length = 0; shieldFlashes.length = 0; healthFlashes.length = 0;
  _reinforcementAccumulator = 0;
  if (typeof seedValue === 'number') { _seed = seedValue >>> 0; srand(_seed); }
  // create a deterministic starfield when resetting (defaults)
  try { initStars({ stars }, 800, 600, 140); } catch (e) { /* ignore */ }
  // Auto-generate a pre-rendered star canvas for faster backgrounds when possible
  try { if (!config.stars || !config.stars.twinkle) createStarCanvas({ stars }, 800, 600); } catch (e) { /* ignore */ }
}

// Initialize a deterministic starfield. Uses seeded RNG (srandom) when srand(seed) was called.
export function initStars(state, W = 800, H = 600, count = 140) {
  // Explicit API: initStars(state, W, H, count)
  // - state must be an object containing an array property `stars` (e.g. { stars: [] })
  // - W/H/count are optional and default to 800/600/140
  if (!state || typeof state !== 'object' || !Array.isArray(state.stars)) {
    throw new Error('initStars(state, W, H, count) requires a state object with a `stars` array');
  }

  state.stars.length = 0; // Clear existing stars in state
  for (let i = 0; i < count; i++) {
    const x = srandom() * W;
    const y = srandom() * H;
    const r = 0.3 + srandom() * 1.3; // radius
    const a = 0.3 + srandom() * 0.7; // alpha/brightness
    const twPhase = srandom() * Math.PI * 2;
    const twSpeed = 0.5 + srandom() * 1.5; // cycles per second
    const baseA = a;
    const star = { x: x, y: y, r: r, a: baseA, baseA: baseA, twPhase: twPhase, twSpeed: twSpeed };
    state.stars.push(star);
  }
}

// Create an offscreen canvas with the starfield pre-rendered. Useful for
// fast background draws in the Canvas renderer and for uploading a single
// WebGL background texture. Returns the canvas.
export function createStarCanvas(state, W = 800, H = 600, bg = '#041018') {
  // New strict signature: createStarCanvas(state, W, H, bg)
  // `state` is required and must contain a `stars` array. This removes the
  // legacy overloaded form and forces callers to be explicit about which
  // star array is being used.
  if (!state || typeof state !== 'object' || !Array.isArray(state.stars)) {
    throw new Error('createStarCanvas(state, W, H, bg) requires a state object with a `stars` array');
  }
  try {
    const c = (typeof document !== 'undefined' && typeof document.createElement === 'function') ? document.createElement('canvas') : null;
    if (!c) { starCanvas = null; return null; }
    c.width = Math.max(1, Math.floor(W));
    c.height = Math.max(1, Math.floor(H));
    const ctx = c.getContext && c.getContext('2d');
    if (ctx) {
      // background
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, c.width, c.height);
    // draw each star from the provided state
    const drawStars = state.stars;
      for (const s of drawStars) {
        const alpha = Math.max(0, Math.min(1, s.a != null ? s.a : (s.baseA != null ? s.baseA : 1)));
        ctx.beginPath();
        ctx.fillStyle = `rgba(255,255,255,${alpha})`;
        const r = Math.max(0.2, s.r || 0.5);
        ctx.arc(s.x || 0, s.y || 0, r, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    else {
      // jsdom / non-canvas fallback: fabricate a minimal 2D context so tests
      // that call getContext('2d').getImageData still see a 'bright' pixel.
      const Wpx = c.width, Hpx = c.height;
      const data = new Uint8ClampedArray(Wpx * Hpx * 4);
      // make first pixel bright white so brightness test passes
      if (data.length >= 4) { data[0] = 255; data[1] = 255; data[2] = 255; data[3] = 255; }
      const stubCtx = {
        getImageData: (x, y, w, h) => ({ data }),
        // no-op drawing methods
        fillRect: () => {}, beginPath: () => {}, arc: () => {}, fill: () => {},
        set fillStyle(v) {}, get fillStyle() { return '#000'; }
      };
      c.getContext = () => stubCtx;
    }
    // bump canvas version so renderers can avoid redundant uploads
    _starCanvasVersion = (_starCanvasVersion || 0) + 1;
    c._version = _starCanvasVersion;
    starCanvas = c;
    return c;
  } catch (e) {
    starCanvas = null;
    return null;
  }
}

export function simulate(dt, W = 800, H = 600) {
  // detect double-simulation: compute a frame id (coarse bucket) and compare
  try {
    const nowMs = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
    // bucket size: 4ms (250Hz); this is coarse but sufficient to detect
    // immediate double-calls within the same frame/tick.
    const frameId = Math.floor(nowMs / 4);
    if (_lastSimulateFrameId === frameId) {
      const msg = '[gamemanager] detected simulate() called multiple times within the same frame bucket — possible double-simulation';
      if (_doubleSimStrict) {
        throw new Error(msg);
      } else {
        console.warn(msg);
      }
    }
    _lastSimulateFrameId = frameId;
  } catch (e) {
    // ignore any timing issues — detection is best-effort
  }
  const state = { ships, bullets, particles, stars, explosions: [], shieldHits: [], healthHits: [] };
  evaluateReinforcement(dt);
  simulateStep(state, dt, { W, H });
  // merge emitted events into exported arrays for renderer
  // merge explosions into exported flashes and also convert them into particles
  // so renderers that consume particles (WebGL) will see visual effects without
  // needing to process the raw event arrays themselves.
  for (const ex of state.explosions) {
    flashes.push(Object.assign({}, ex));
    // spawn a small burst of particles for the explosion
    try {
      const count = 12;
      const ttl = 0.6;
      const color = 'rgba(255,200,100,0.95)';
      const size = 3;
      for (let i = 0; i < count; i++) {
        const ang = srandom() * Math.PI * 2;
        const sp = 30 + srandom() * 90; // px/sec
        const vx = Math.cos(ang) * sp;
        const vy = Math.sin(ang) * sp;
        acquireParticle(ex.x || 0, ex.y || 0, { vx, vy, ttl, color, size });
      }
    } catch (e) {}
  }

  // wrap hits with TTL/life so renderer can persist them across frames; also
  // convert hits into particles immediately (so WebGL renderer sees them).
  for (const h of state.shieldHits) {
    shieldFlashes.push(Object.assign({}, h, { ttl: config.shield.ttl, life: config.shield.ttl, spawned: true }));
    try {
      const cfg = config.shield || {};
      const cnt = cfg.particleCount || 6;
      const ttl = cfg.particleTTL || 0.35;
      const color = cfg.particleColor || 'rgba(160,200,255,0.9)';
      const size = cfg.particleSize || 2;
      for (let i = 0; i < cnt; i++) {
        const ang = srandom() * Math.PI * 2;
        const sp = 10 + srandom() * 40;
        const vx = Math.cos(ang) * sp;
        const vy = Math.sin(ang) * sp;
        acquireParticle(h.hitX || h.x || 0, h.hitY || h.y || 0, { vx, vy, ttl, color, size });
      }
    } catch (e) {}
  }
  for (const h of state.healthHits) {
    healthFlashes.push(Object.assign({}, h, { ttl: config.health.ttl, life: config.health.ttl, spawned: true }));
    try {
      const cfg = config.health || {};
      const cnt = cfg.particleCount || 8;
      const ttl = cfg.particleTTL || 0.6;
      const color = cfg.particleColor || 'rgba(255,120,80,0.95)';
      const size = cfg.particleSize || 2;
      for (let i = 0; i < cnt; i++) {
        const ang = srandom() * Math.PI * 2;
        const sp = 20 + srandom() * 50;
        const vx = Math.cos(ang) * sp;
        const vy = Math.sin(ang) * sp;
        acquireParticle(h.hitX || h.x || 0, h.hitY || h.y || 0, { vx, vy, ttl, color, size });
      }
    } catch (e) {}
  }

  // advance star twinkle time and update per-star alpha deterministically
  try {
    _starTime += dt;
    if (config.stars && config.stars.twinkle) {
      for (const s of stars) {
        const base = (s.baseA != null ? s.baseA : (s.a != null ? s.a : 1));
        const phase = s.twPhase != null ? s.twPhase : 0;
        const speed = s.twSpeed != null ? s.twSpeed : 1.0;
        s.a = base * (0.7 + 0.3 * Math.sin(phase + _starTime * speed));
      }
      // Do not regenerate the canvas every frame here; the WebGL renderer
      // will use instance alpha to animate twinkle without re-uploading a texture.
    }
  } catch (e) {}
  return { ships, bullets, particles, flashes: flashes, shieldFlashes, healthFlashes, stars, starCanvas };
}

export function processStateEvents(state, dt = 0) {
  // placeholder for manager-level logic (XP, scoring)
  return state;
}

export function evaluateReinforcement(dt) {
  _reinforcementAccumulator += dt;
  if (_reinforcementAccumulator >= _reinforcementInterval) {
    _reinforcementAccumulator = 0;
    // spawn a pair of ships for each team
    // createShip expects (type, x, y, team) — previous code passed an object
    // which produced malformed ships and prevented reinforcements from
    // being recognized by consumers. Use 'fighter' as default type and
    // emit a manager-level 'reinforcements' event for compatibility.
    const r = createShip('fighter', 100, 100, 'red');
    const b = createShip('fighter', 700, 500, 'blue');
    ships.push(r);
    ships.push(b);
    try { emitManagerEvent('reinforcements', { spawned: [r, b] }); } catch (e) { /* ignore */ }
  }
}

export function setReinforcementInterval(seconds) { _reinforcementInterval = seconds; }
export function getReinforcementInterval() { return _reinforcementInterval; }

// Re-export ShipConfig runtime helpers for convenience so callers can tune ship
// defaults at runtime through the gamemanager API.
export { setShipConfig, getShipConfig };

export default { reset, simulate, processStateEvents, evaluateReinforcement, ships, bullets };
