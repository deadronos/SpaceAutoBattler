// Minimal TypeScript shim that re-exports the existing JavaScript runtime implementation.
// Import the runtime as a namespace and re-export value bindings to avoid
// circular alias issues. Types are defined in `gamemanager.d.ts`.

// Ported from gamemanager.js, now canonical TypeScript implementation
import { makeInitialState, createShip } from "./entities";
import { PARTICLE_DEFAULTS } from "./config/entitiesConfig";
import { applySimpleAI } from "./behavior";
import { simulateStep } from "./simulate";
import { SIM } from "./config/simConfig";
import { srand, srandom } from "./rng";
import { createSimWorker } from "./createSimWorker";
import {
  SHIELD,
  HEALTH,
  EXPLOSION,
  STARS,
  FALLBACK_POSITIONS,
} from "./config/gamemanagerConfig";
<<<<<<< HEAD
<<<<<<< HEAD
import type { ShipConfigMap, GameState } from "./types";
=======
import type { ShipConfigMap } from "./types";
>>>>>>> origin/dev
=======
import type { ShipConfigMap } from "./types";
>>>>>>> origin/dev
import { getShipConfig, getDefaultShipType } from "./config/entitiesConfig";
import {
  chooseReinforcementsWithManagerSeed,
  makeInitialFleets,
  TeamsConfig,
} from "./config/teamsConfig";

export const ships: any[] = [];
export const bullets: any[] = [];
export const particles: any[] = [];
export const stars: any[] = [];
export const flashes: any[] = [];
export const shieldFlashes: any[] = [];
export const healthFlashes: any[] = [];
export const particlePool: any[] = [];
export const bulletPool: any[] = [];
export const explosionPool: any[] = [];
export const shieldHitPool: any[] = [];
export const healthHitPool: any[] = [];
// Bullet pooling
export function acquireBullet(opts: any = {}): any {
  let b: any = null;
  if (bulletPool.length) {
    b = bulletPool.pop();
    Object.assign(b, opts);
    b.alive = true;
  } else {
    b = { ...opts, alive: true };
  }
  bullets.push(b);
  return b;
}
export function releaseBullet(b: any) {
  if (!b.alive) return; // Prevent double-free
  b.alive = false;
  bulletPool.push(b);
}

// Explosion pooling
export function acquireExplosion(opts: any = {}): any {
  let e: any;
  if (explosionPool.length) {
    e = explosionPool.pop();
    Object.assign(e, opts);
    e.alive = true;
    e._pooled = false; // Reset pooled flag
  } else {
    e = { ...opts, alive: true, _pooled: false };
  }
  flashes.push(e);
  return e;
}
export function releaseExplosion(e: any) {
  if (e._pooled) return;
  if (!e.alive) return;
  e.alive = false;
  e._pooled = true;
  explosionPool.push(e);
}

// ShieldHit pooling
export function acquireShieldHit(opts: any = {}): any {
  let sh: any = null;
  if (shieldHitPool.length) {
    sh = shieldHitPool.pop();
    Object.assign(sh, opts);
    sh.alive = true;
    sh._pooled = false; // Reset pooled flag
  } else {
    sh = { ...opts, alive: true, _pooled: false };
  }
  shieldFlashes.push(sh);
  return sh;
}
export function releaseShieldHit(sh: any) {
  if (sh._pooled) return;
  const i = shieldFlashes.indexOf(sh);
  if (i !== -1) shieldFlashes.splice(i, 1);
  sh.alive = false;
  sh._pooled = true;
  shieldHitPool.push(sh);
}

// HealthHit pooling
export function acquireHealthHit(opts: any = {}): any {
  let hh: any = null;
  if (healthHitPool.length) {
    hh = healthHitPool.pop();
    Object.assign(hh, opts);
    hh.alive = true;
    hh._pooled = false; // Reset pooled flag
  } else {
    hh = { ...opts, alive: true, _pooled: false };
  }
  healthFlashes.push(hh);
  return hh;
}
export function releaseHealthHit(hh: any) {
  if (hh._pooled) return;
  const i = healthFlashes.indexOf(hh);
  if (i !== -1) healthFlashes.splice(i, 1);
  hh.alive = false;
  hh._pooled = true;
  healthHitPool.push(hh);
}

export const config = {
  shield: { ...SHIELD },
  health: { ...HEALTH },
  explosion: { ...EXPLOSION },
  stars: { ...STARS },
};

let _seed: number | null = null;
let _reinforcementInterval: number =
  TeamsConfig.continuousReinforcement?.interval ?? 5.0;
let _reinforcementAccumulator = 0;
let _starCanvasVersion = 0;
let starCanvas: HTMLCanvasElement | null = null;
let _lastSimulateFrameId: number | null = null;
let _doubleSimStrict = false;

export function setDoubleSimStrict(v: boolean = false) {
  _doubleSimStrict = !!v;
}

export class Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  ttl: number;
  life: number;
  color: string;
  size: number;
  alive: boolean;
  _pooled?: boolean; // Add pooled flag to prevent double-free
  constructor(x = 0, y = 0, vx = 0, vy = 0, ttl = 1, color = "#fff", size = 2) {
    this.x = x;
    this.y = y;
    this.vx = vx;
    this.vy = vy;
    this.ttl = ttl;
    this.life = ttl;
    this.color = color;
    this.size = size;
    this.alive = true;
    this._pooled = false;
  }
}

export function acquireParticle(
  x: number,
  y: number,
  opts: Partial<Particle> = {},
): Particle {
  let p: Particle;
  if (particlePool.length) {
    p = particlePool.pop()!;
    p.x = x;
    p.y = y;
    p.vx = opts.vx ?? 0;
    p.vy = opts.vy ?? 0;
    p.ttl = opts.ttl ?? PARTICLE_DEFAULTS.ttl;
    p.life = p.ttl;
    p.color = opts.color ?? PARTICLE_DEFAULTS.color;
    p.size = opts.size ?? PARTICLE_DEFAULTS.size;
    p.alive = true;
    p._pooled = false;
  } else {
    p = new Particle(
      x,
      y,
      opts.vx ?? 0,
      opts.vy ?? 0,
      opts.ttl ?? PARTICLE_DEFAULTS.ttl,
      opts.color ?? PARTICLE_DEFAULTS.color,
      opts.size ?? PARTICLE_DEFAULTS.size,
    );
  }
  particles.push(p);
  return p;
}

export function releaseParticle(p: Particle) {
  if (!p._pooled) {
    p._pooled = true;
    p.alive = false;
    // Remove from active particles array if present
    const idx = particles.indexOf(p);
    if (idx !== -1) {
      particles.splice(idx, 1);
    }
    particlePool.push(p);
  }
}

export function reset(seedValue: number | null = null) {
  ships.length = 0;
  bullets.length = 0;
  particles.length = 0;
  stars.length = 0;
  flashes.length = 0;
  shieldFlashes.length = 0;
  healthFlashes.length = 0;
  _reinforcementAccumulator = 0;
  if (typeof seedValue === "number") {
    _seed = seedValue >>> 0;
    srand(_seed);
  }
}

<<<<<<< HEAD
<<<<<<< HEAD
export function initStars(state: GameState, W = 800, H = 600, count = 140) {
=======
export function initStars(state: any, W = 800, H = 600, count = 140) {
>>>>>>> origin/dev
=======
export function initStars(state: any, W = 800, H = 600, count = 140) {
>>>>>>> origin/dev
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

export function createStarCanvas(
<<<<<<< HEAD
<<<<<<< HEAD
  state: GameState,
=======
  state: any,
>>>>>>> origin/dev
=======
  state: any,
>>>>>>> origin/dev
  W = 800,
  H = 600,
  bg = "#041018",
): HTMLCanvasElement | null {
  if (!state || !Array.isArray(state.stars)) return null;
  try {
    const c =
      typeof document !== "undefined" && document.createElement
        ? document.createElement("canvas")
        : null;
    if (!c) return null;
    c.width = Math.max(1, Math.floor(W));
    c.height = Math.max(1, Math.floor(H));
    const ctx = c.getContext && c.getContext("2d");
    if (ctx) {
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, c.width, c.height);
      for (const s of state.stars) {
        const alpha = Math.max(
          0,
          Math.min(1, s.a != null ? s.a : s.baseA != null ? s.baseA : 1),
        );
        ctx.beginPath();
        ctx.fillStyle = `rgba(255,255,255,${alpha})`;
        const rr = Math.max(0.2, s.r || 0.5);
        ctx.arc(s.x || 0, s.y || 0, rr, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    _starCanvasVersion = (_starCanvasVersion || 0) + 1;
    (c as any)._version = _starCanvasVersion;
    starCanvas = c;
    return c;
  } catch (e) {
    return null;
  }
}

export function getStarCanvasVersion() {
  return _starCanvasVersion;
}

export function setReinforcementInterval(seconds: number) {
  _reinforcementInterval =
    Number(seconds) || (TeamsConfig.continuousReinforcement?.interval ?? 5.0);
}
export function getReinforcementInterval() {
  return _reinforcementInterval;
}

function emitManagerEvent(
  map: Map<string, Function[]>,
  type: string,
  data: any,
) {
  const arr = map.get(type) || [];
  for (const cb of arr.slice()) {
    try {
      if (typeof cb === "function") cb(data);
    } catch (e) {}
  }
}

function evaluateReinforcement(
  dt: number,
<<<<<<< HEAD
<<<<<<< HEAD
  state: GameState,
=======
  state: any,
>>>>>>> origin/dev
=======
  state: any,
>>>>>>> origin/dev
  continuousOptions: any = {},
): { spawned: any[] } | null {
  _reinforcementAccumulator += dt;
  if (_reinforcementAccumulator >= _reinforcementInterval) {
    _reinforcementAccumulator = 0;
    try {
      if (typeof chooseReinforcementsWithManagerSeed === "function") {
        const orders = chooseReinforcementsWithManagerSeed(state, {
          ...continuousOptions,
          bounds: SIM.bounds,
          enabled: true,
        });
        if (Array.isArray(orders) && orders.length) {
          const spawned: any[] = [];
          for (const o of orders) {
            try {
              const ship = createShip(
                o.type || getDefaultShipType(),
                o.x || 100,
                o.y || 100,
                o.team || "red",
              );
              state.ships.push(ship);
              spawned.push(ship);
            } catch (e) {}
          }
          return { spawned };
        }
      }
      const fallback = getDefaultShipType();
      const r = createShip(
        fallback,
        FALLBACK_POSITIONS[0].x,
        FALLBACK_POSITIONS[0].y,
        FALLBACK_POSITIONS[0].team,
      );
      const b = createShip(
        fallback,
        FALLBACK_POSITIONS[1].x,
        FALLBACK_POSITIONS[1].y,
        FALLBACK_POSITIONS[1].team,
      );
      state.ships.push(r);
      state.ships.push(b);
      return { spawned: [r, b] };
    } catch (e) {
      return null;
    }
  }
  return null;
}

export interface GameManagerOptions {
  useWorker?: boolean;
  renderer?: any;
  seed?: number;
  createSimWorker?: typeof createSimWorker;
}

export function createGameManager({
  useWorker = true,
  renderer = null,
  seed = 12345,
  createSimWorker: createSimWorkerFactory,
}: GameManagerOptions = {}) {
<<<<<<< HEAD
<<<<<<< HEAD
  let state: GameState = makeInitialState();
=======
  let state = makeInitialState();
>>>>>>> origin/dev
=======
  let state = makeInitialState();
>>>>>>> origin/dev
  let running = false;
  const listeners = new Map<string, Function[]>();
  const workerReadyCbs: Function[] = [];
  let simWorker: any = null;
  // Worker event handler refs (declared here so destroy() can unregister them)
  let _workerReadyHandler: Function | null = null;
  let _workerSnapshotHandler: Function | null = null;
  let _workerReinforcementsHandler: Function | null = null;
  let workerReady = false;
  let lastReinforcement: { spawned: any[]; timestamp: number; options: any } = {
    spawned: [],
    timestamp: 0,
    options: {},
  };
  let continuous = false;
  let continuousOptions: any = {};

  function emit(type: string, msg: any) {
    emitManagerEvent(listeners, type, msg);
  }
  function _mgr_random() {
    return srandom();
  }

  try {
    if (useWorker) {
      const factory = createSimWorkerFactory || createSimWorker;
      let simWorkerUrl;
      try {
        // Only use import.meta.url if available (ES2022+)
        simWorkerUrl =
          typeof import.meta !== "undefined" && import.meta.url
            ? new URL("./simWorker.js", import.meta.url).href
            : "./simWorker.js";
      } catch (e) {
        simWorkerUrl = "./simWorker.js";
      }
      simWorker = factory(simWorkerUrl);
<<<<<<< HEAD
<<<<<<< HEAD
      // Keep references to worker handler functions so they can be removed on destroy
=======
  // Keep references to worker handler functions so they can be removed on destroy
>>>>>>> origin/dev
=======
  // Keep references to worker handler functions so they can be removed on destroy
>>>>>>> origin/dev

      _workerReadyHandler = () => {
        workerReady = true;
        for (const cb of workerReadyCbs.slice()) {
<<<<<<< HEAD
<<<<<<< HEAD
          try {
            cb();
          } catch (e) {}
=======
          try { cb(); } catch (e) {}
>>>>>>> origin/dev
=======
          try { cb(); } catch (e) {}
>>>>>>> origin/dev
        }
      };
      simWorker.on && simWorker.on("ready", _workerReadyHandler);

      _workerSnapshotHandler = (m: any) => {
        if (m && m.state) state = m.state;
      };
      simWorker.on && simWorker.on("snapshot", _workerSnapshotHandler);

      _workerReinforcementsHandler = (m: any) => {
        emit("reinforcements", m);
      };
<<<<<<< HEAD
<<<<<<< HEAD
      simWorker.on &&
        simWorker.on("reinforcements", _workerReinforcementsHandler);
=======
      simWorker.on && simWorker.on("reinforcements", _workerReinforcementsHandler);
>>>>>>> origin/dev
=======
      simWorker.on && simWorker.on("reinforcements", _workerReinforcementsHandler);
>>>>>>> origin/dev
      try {
        simWorker.post({
          type: "init",
          seed,
          bounds: SIM.bounds,
          simDtMs: SIM.DT_MS,
          state,
        });
        simWorker.post({ type: "start" });
      } catch (e) {}
    }
  } catch (e) {
    simWorker = null;
  }

  function _evaluateAndEmit(dt: number) {
    const result = evaluateReinforcement(dt, state, continuousOptions);
    if (result && Array.isArray(result.spawned) && result.spawned.length) {
      lastReinforcement = {
        spawned: result.spawned,
        timestamp: Date.now(),
        options: { ...continuousOptions },
      };
      emit("reinforcements", { spawned: result.spawned });
    }
  }

  function step(dtSeconds: number) {
    // Clamp dtSeconds to a max of 0.05 to prevent teleportation on lag spikes
    const clampedDt = Math.min(dtSeconds, 0.05);
    if (!simWorker) {
      // Run AI logic before simulation step
      try {
        applySimpleAI(state, clampedDt, SIM.bounds);
      } catch (e) {}
      try {
        simulateStep(state, clampedDt, SIM.bounds);
      } catch (e) {}
    } else {
      try {
        simWorker.post && simWorker.post({ type: "snapshotRequest" });
      } catch (e) {}
    }
    _evaluateAndEmit(clampedDt);
    // Prune all high-frequency event arrays in-place
    // (ships array is handled separately for hp > 0)
    if (typeof simulateStep === "function") {
      simulateStep(state, clampedDt, SIM.bounds);
    }
    // Flashes and event arrays are pruned by simulation now; no need for decay/splice/filter here.
    if (renderer && typeof renderer.renderState === "function") {
      try {
        renderer.renderState({
          ships: state.ships,
          bullets: state.bullets,
          flashes,
          shieldFlashes,
          healthFlashes,
          t: state.t,
        });
      } catch (e) {}
    }
  }

  let last =
    typeof performance !== "undefined" && performance.now
      ? performance.now()
      : Date.now();
  let acc = 0;
  function runLoop() {
    if (!running) return;
    const now =
      typeof performance !== "undefined" && performance.now
        ? performance.now()
        : Date.now();
    acc += now - last;
    last = now;
    if (acc > 250) acc = 250;
    while (acc >= SIM.DT_MS) {
      step(SIM.DT_MS / 1000);
      acc -= SIM.DT_MS;
    }
    try {
      requestAnimationFrame(runLoop);
    } catch (e) {
      setTimeout(runLoop, SIM.DT_MS);
    }
  }

  function on(evt: string, cb: Function) {
    const arr = listeners.get(evt) || [];
    arr.push(cb);
    listeners.set(evt, arr);
  }
  function off(evt: string, cb: Function) {
    const arr = listeners.get(evt) || [];
    const i = arr.indexOf(cb);
    if (i !== -1) arr.splice(i, 1);
  }
  /**
   * destroy()
   * ---------
   * Tear down all internal resources owned by the GameManager.
   * - Stops the run loop (idempotent).
   * - Unregisters any internal worker event handlers that were attached
   *   to the sim worker so external references are not retained.
   * - Terminates/closes the sim worker if possible, or posts a stop
   *   message as a best-effort fallback.
   * - Clears internal worker-ready callbacks and resets worker state.
   *
   * Contract and guarantees:
   * - Safe to call multiple times (idempotent).
   * - Will not throw on missing or partially-initialized worker.
   * - Designed to be called before higher-level cleanup (e.g. UI dispose)
   *   so that worker-side handlers are removed while manager internals
   *   are still available.
   */
  function destroy() {
    // Stop running loop
    running = false;
    // Tear down worker and its handlers
    try {
      if (simWorker) {
        try {
<<<<<<< HEAD
<<<<<<< HEAD
          if (typeof simWorker.off === "function") {
            try {
              if (_workerReadyHandler)
                simWorker.off("ready", _workerReadyHandler);
            } catch (e) {}
            try {
              if (_workerSnapshotHandler)
                simWorker.off("snapshot", _workerSnapshotHandler);
            } catch (e) {}
            try {
              if (_workerReinforcementsHandler)
                simWorker.off("reinforcements", _workerReinforcementsHandler);
            } catch (e) {}
          }
        } catch (e) {}
        try {
          if (typeof simWorker.terminate === "function") simWorker.terminate();
          else if (typeof simWorker.close === "function") simWorker.close();
          else if (typeof simWorker.post === "function")
            simWorker.post({ type: "stop" });
        } catch (e) {}
=======
=======
>>>>>>> origin/dev
          if (typeof simWorker.off === 'function') {
            try { if (_workerReadyHandler) simWorker.off('ready', _workerReadyHandler); } catch (e) {}
            try { if (_workerSnapshotHandler) simWorker.off('snapshot', _workerSnapshotHandler); } catch (e) {}
            try { if (_workerReinforcementsHandler) simWorker.off('reinforcements', _workerReinforcementsHandler); } catch (e) {}
          }
        } catch (e) {}
        try { if (typeof simWorker.terminate === 'function') simWorker.terminate(); else if (typeof simWorker.close === 'function') simWorker.close(); else if (typeof simWorker.post === 'function') simWorker.post({ type: 'stop' }); } catch (e) {}
<<<<<<< HEAD
>>>>>>> origin/dev
=======
>>>>>>> origin/dev
        simWorker = null;
      }
    } catch (e) {}
    workerReady = false;
    workerReadyCbs.length = 0;
<<<<<<< HEAD
<<<<<<< HEAD
    // Dispose renderer assets if possible
    if (renderer && typeof renderer.dispose === "function") {
      try {
        renderer.dispose();
      } catch (e) {}
    }
    // Clear asset references in GameState
    starCanvas = null;
=======
>>>>>>> origin/dev
=======
>>>>>>> origin/dev
  }
  function start() {
    if (!running) {
      running = true;
      last =
        typeof performance !== "undefined" && performance.now
          ? performance.now()
          : Date.now();
      runLoop();
    }
  }
  function pause() {
    running = false;
  }
  function resetManager() {
    state = makeInitialState();
    if (simWorker)
      try {
        simWorker.post({ type: "command", cmd: "setState", args: { state } });
      } catch (e) {}
  }
  function stepOnce(dt = SIM.DT_MS / 1000) {
    const n = Number(dt) || SIM.DT_MS / 1000;
    step(n);
  }
  function setContinuousEnabled(v: boolean = false) {
    continuous = !!v;
    if (simWorker) {
      try {
        simWorker.post({ type: "setContinuous", value: !!v });
      } catch (e) {}
    } else {
      if (continuous) {
        const result = evaluateReinforcement(
          SIM.DT_MS / 1000,
          state,
          continuousOptions,
        );
        if (result && Array.isArray(result.spawned) && result.spawned.length) {
          lastReinforcement = {
            spawned: result.spawned,
            timestamp: Date.now(),
            options: { ...continuousOptions },
          };
          emit("reinforcements", { spawned: result.spawned });
        }
      }
    }
  }
  function isContinuousEnabled() {
    return !!continuous;
  }
  function setContinuousOptions(opts: any = {}) {
    continuousOptions = { ...continuousOptions, ...opts };
    if (simWorker)
      try {
        simWorker.post({
          type: "setContinuousOptions",
          opts: continuousOptions,
        });
      } catch (e) {}
  }
  function getContinuousOptions() {
    return { ...continuousOptions };
  }
  function setReinforcementIntervalManager(seconds: number) {
    setReinforcementInterval(seconds);
    if (simWorker)
      try {
        simWorker.post({ type: "setReinforcementInterval", seconds });
      } catch (e) {}
  }
  function getReinforcementIntervalManager() {
    return getReinforcementInterval();
  }
  function isRunning() {
    return running;
  }
  function isWorker() {
    return !!simWorker && !!workerReady;
  }
  function onWorkerReady(cb: Function) {
    if (typeof cb === "function") workerReadyCbs.push(cb);
  }
  function offWorkerReady(cb: Function) {
    const i = workerReadyCbs.indexOf(cb);
    if (i !== -1) workerReadyCbs.splice(i, 1);
  }
  function spawnShip(team: string = "red") {
    try {
      const type = getDefaultShipType();
      const b = SIM.bounds;
      const x = Math.max(0, Math.min(b.W - 1e-6, srandom() * b.W));
      const y = Math.max(0, Math.min(b.H - 1e-6, srandom() * b.H));
      const ship = createShip(type, x, y, team);
      state.ships.push(ship);
      return ship;
    } catch (e) {
      return null;
    }
  }

  // Fleet formation (config-driven)
  function formFleets() {
    try {
      // Remove all ships
      state.ships.length = 0;
      // Use makeInitialFleets from teamsConfig (static import)
      const bounds = SIM.bounds;
      const seed = Math.floor(srandom() * 0xffffffff) >>> 0;
      const ships = makeInitialFleets(seed, bounds, createShip);
      for (const ship of ships) {
        state.ships.push(ship);
      }
    } catch (e) {
      /* ignore errors */
    }
  }
  function reseedManager(newSeed: number = Math.floor(srandom() * 0xffffffff)) {
    _seed = newSeed >>> 0;
    srand(_seed);
    if (simWorker)
      try {
        simWorker.post({ type: "setSeed", seed: _seed });
      } catch (e) {}
  }
  function getLastReinforcement() {
    return { ...lastReinforcement };
  }
  function snapshot() {
    return {
      ships: state.ships.slice(),
      bullets: state.bullets.slice(),
      t: state.t,
    };
  }
  const score = { red: 0, blue: 0 };
  const internal = { state, bounds: SIM.bounds };

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
    formFleets,
    destroy,
    _internal: internal,
  };
}

export function simulate(dt: number, W = 800, H = 600) {
  try {
    const now =
      typeof performance !== "undefined" && performance.now
        ? performance.now()
        : Date.now();
    const frame = Math.floor(now / 4);
    if (_lastSimulateFrameId === frame) {
      const msg =
        "[gamemanager] detected simulate() called multiple times in same frame";
      if (_doubleSimStrict) throw new Error(msg);
      else console.warn(msg);
    }
    _lastSimulateFrameId = frame;
  } catch (e) {}
<<<<<<< HEAD
<<<<<<< HEAD
  const state: GameState = {
    t: 0,
    ships,
    bullets,
    explosions: [],
    shieldHits: [],
    healthHits: [],
    particles,
    stars,
    flashes,
    shieldFlashes,
    healthFlashes,
    starCanvas: starCanvas || undefined,
=======
=======
>>>>>>> origin/dev
  const state = {
    ships,
    bullets,
    particles,
    stars,
    explosions: [],
    shieldHits: [],
    healthHits: [],
<<<<<<< HEAD
>>>>>>> origin/dev
=======
>>>>>>> origin/dev
  };
  evaluateReinforcement(dt, state);
  try {
    simulateStep(state, dt, SIM.bounds);
  } catch (e) {}
  for (const ex of state.explosions) {
    if (ex && typeof ex === "object") flashes.push({ ...(ex as object) });
    try {
      const count = 12;
      for (let i = 0; i < count; i++) {
        const ang = srandom() * Math.PI * 2;
        const sp = 30 + srandom() * 90;
        acquireParticle((ex as any).x || 0, (ex as any).y || 0, {
          vx: Math.cos(ang) * sp,
          vy: Math.sin(ang) * sp,
          ttl: 0.6,
          color: "rgba(255,200,100,0.95)",
          size: 3,
        });
      }
    } catch (e) {}
  }
  for (const h of state.shieldHits) {
    if (h && typeof h === "object") shieldFlashes.push({ ...(h as object) });
  }
  for (const h of state.healthHits) {
    if (h && typeof h === "object") healthFlashes.push({ ...(h as object) });
  }
  return {
    ships,
    bullets,
    particles,
    flashes,
    shieldFlashes,
    healthFlashes,
    stars,
    starCanvas,
  };
}

export function processStateEvents(state: any, dt: number = 0) {
  return state;
}

export default createGameManager;
