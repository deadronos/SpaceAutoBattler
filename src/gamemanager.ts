// Minimal TypeScript shim that re-exports the existing JavaScript runtime implementation.
// Import the runtime as a namespace and re-export value bindings to avoid
// circular alias issues. Types are defined in `gamemanager.d.ts`.

// Ported from gamemanager.js, now canonical TypeScript implementation
import { makeInitialState, createShip, Ship, Bullet, genId, ExplosionEffect, ShieldHitEffect, HealthHitEffect, createExplosionEffect, resetExplosionEffect, createShieldHitEffect, resetShieldHitEffect, createHealthHitEffect, resetHealthHitEffect } from "./entities";
import { updateTeamCount } from "./entities";
import { PARTICLE_DEFAULTS } from "./config/entitiesConfig";
import { applySimpleAI } from "./behavior";
import { simulateStep } from "./simulate";
import { SIM } from "./config/simConfig";
import { srand, srandom } from "./rng";
import { createSimWorker } from "./createSimWorker";
import { acquireEffect, releaseEffect, acquireSprite, releaseSprite, makePooled } from "./entities";
import {
  SHIELD,
  HEALTH,
  EXPLOSION,
  STARS,
  FALLBACK_POSITIONS,
} from "./config/gamemanagerConfig";
import type { ShipConfigMap, GameState } from "./types";
import { getShipConfig, getDefaultShipType } from "./config/entitiesConfig";
import {
  chooseReinforcementsWithManagerSeed,
  makeInitialFleets,
  TeamsConfig,
} from "./config/teamsConfig";

export const ships: Ship[] = [];
export const bullets: Bullet[] = [];
export const particles: Particle[] = [];
export const stars: Array<Record<string, unknown>> = [];
export const flashes: ExplosionEffect[] = [];
export const shieldFlashes: ShieldHitEffect[] = [];
export const healthFlashes: HealthHitEffect[] = [];
// Bullet pooling
// Bullets: support optional GameState-backed pooling. If `state` is provided,
// use state.assetPool.sprites keyed by 'bullet', otherwise fallback to legacy in-memory pool.
export function acquireBullet(state: GameState, opts: Partial<Bullet> = {}): Bullet {
  // Use state-backed sprite pool keyed by 'bullet'
  const key = 'bullet';
  const b = acquireSprite(state, key, () => makePooled({ ...opts, id: genId(), alive: true } as any, (o: any, initArgs?: any) => Object.assign(o, initArgs)), opts) as Bullet & any;
  // push into the state-active array so simulation sees it
  (state.bullets ||= []).push(b as Bullet);
  return b;
}

export function releaseBullet(state: GameState, b?: Bullet): void {
  if (!b) return;
  if (!b.alive) return; // Prevent double-free
  b.alive = false;
  // remove from the state's active bullets
  const arr = state.bullets || [] as Bullet[];
  const idx = arr.indexOf(b as Bullet);
  if (idx !== -1) arr.splice(idx, 1);
  releaseSprite(state, 'bullet', b as any, undefined);
}

// Explosion pooling
export function acquireExplosion(state: GameState, opts: Partial<ExplosionEffect> = {}): ExplosionEffect {
  const key = 'explosion';
  const e = acquireEffect<ExplosionEffect>(state, key, () => makePooled(createExplosionEffect(opts), resetExplosionEffect), opts);
  (state.explosions ||= []).push(e);
  return e;
}

export function releaseExplosion(state: GameState, e?: ExplosionEffect) {
  if (!e) return;
  if (e._pooled) return;
  if (!e.alive) return;
  e.alive = false;
  e._pooled = true;
  const arr = state.explosions || [] as ExplosionEffect[];
  const idx = arr.indexOf(e);
  if (idx !== -1) arr.splice(idx, 1);
  releaseEffect(state, 'explosion', e, undefined);
}

// ShieldHit pooling
export function acquireShieldHit(state: GameState, opts: Partial<ShieldHitEffect> = {}): ShieldHitEffect {
  const key = 'shieldHit';
  const sh = acquireEffect<ShieldHitEffect>(state, key, () => makePooled(createShieldHitEffect(opts), resetShieldHitEffect), opts);
  (state.shieldHits ||= []).push(sh);
  return sh;
}

export function releaseShieldHit(state: GameState, sh?: ShieldHitEffect) {
  if (!sh) return;
  if (sh._pooled) return;
  const arr = state.shieldHits || [] as ShieldHitEffect[];
  const i = arr.indexOf(sh);
  if (i !== -1) arr.splice(i, 1);
  sh.alive = false;
  sh._pooled = true;
  releaseEffect(state, 'shieldHit', sh, undefined);
}

// HealthHit pooling
export function acquireHealthHit(state: GameState, opts: Partial<HealthHitEffect> = {}): HealthHitEffect {
  const key = 'healthHit';
  const hh = acquireEffect<HealthHitEffect>(state, key, () => makePooled(createHealthHitEffect(opts), resetHealthHitEffect), opts);
  (state.healthHits ||= []).push(hh);
  return hh;
}

export function releaseHealthHit(state: GameState, hh?: HealthHitEffect) {
  if (!hh) return;
  if (hh._pooled) return;
  const arr = state.healthHits || [] as HealthHitEffect[];
  const i = arr.indexOf(hh);
  if (i !== -1) arr.splice(i, 1);
  hh.alive = false;
  hh._pooled = true;
  releaseEffect(state, 'healthHit', hh, undefined);
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

export function acquireParticle(state: GameState, x: number, y: number, opts: Partial<Particle> = {}): Particle {
  const key = 'particle';
  const p = acquireEffect(state, key, () => makePooled(new Particle(x, y, opts.vx ?? 0, opts.vy ?? 0, opts.ttl ?? PARTICLE_DEFAULTS.ttl, opts.color ?? PARTICLE_DEFAULTS.color, opts.size ?? PARTICLE_DEFAULTS.size), (o: any, initArgs?: any) => Object.assign(o, initArgs)), { x, y, vx: opts.vx ?? 0, vy: opts.vy ?? 0, ttl: opts.ttl ?? PARTICLE_DEFAULTS.ttl, color: opts.color ?? PARTICLE_DEFAULTS.color, size: opts.size ?? PARTICLE_DEFAULTS.size });
  // rehydrate
  p.x = x;
  p.y = y;
  p.vx = opts.vx ?? 0;
  p.vy = opts.vy ?? 0;
  p.ttl = opts.ttl ?? PARTICLE_DEFAULTS.ttl;
  p.life = p.ttl;
  p.color = opts.color ?? PARTICLE_DEFAULTS.color;
  p.size = opts.size ?? PARTICLE_DEFAULTS.size;
  p.alive = true;
  (state.particles ||= []).push(p);
  return p;
}

export function releaseParticle(state: GameState, p?: Particle) {
  if (!p) return;
  const key = 'particle';
  try { releaseEffect(state, key, p, (x) => { /* no-op */ }); } catch {}
  const idx = (state.particles || []).indexOf(p);
  if (idx !== -1) (state.particles || []).splice(idx, 1);
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

export function initStars(state: GameState, W = 800, H = 600, count = 140) {
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
  state: GameState,
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
  state: GameState,
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
                  try { (state as any).shipMap && (state as any).shipMap.set(ship.id, ship); } catch (e) {}
                  try { updateTeamCount(state, undefined, ship.team); } catch (e) {}
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
  try { (state as any).shipMap && (state as any).shipMap.set(r.id, r); } catch (e) {}
  try { updateTeamCount(state, undefined, String(r.team)); } catch (e) {}
      state.ships.push(b);
  try { (state as any).shipMap && (state as any).shipMap.set(b.id, b); } catch (e) {}
  try { updateTeamCount(state, undefined, String(b.team)); } catch (e) {}
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
  let state: GameState = makeInitialState();
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
      // Keep references to worker handler functions so they can be removed on destroy

      _workerReadyHandler = () => {
        workerReady = true;
        for (const cb of workerReadyCbs.slice()) {
          try {
            cb();
          } catch (e) {}
        }
      };
      simWorker.on && simWorker.on("ready", _workerReadyHandler);

      _workerSnapshotHandler = (m: any) => {
        if (m && m.state) {
          state = m.state;
          try {
            (state as any).shipMap = new Map<number, any>();
            state.teamCounts = { red: 0, blue: 0 };
            for (const s of (state.ships || [])) if (s && typeof s.id !== 'undefined') { (state as any).shipMap.set(s.id, s); try { const t = String((s as any).team || ''); state.teamCounts[t] = (state.teamCounts[t] || 0) + 1; } catch (e) {} }
          } catch (e) {}
        }
      };
      simWorker.on && simWorker.on("snapshot", _workerSnapshotHandler);

      // When running the sim in a worker, render from the fresh snapshot the
      // worker posts instead of rendering the (possibly stale) manager state
      // during step(). This prevents a 1-frame lag where bullets may appear
      // but ship positions are not yet updated in the renderer.
      const _origWorkerSnapshotHandler = _workerSnapshotHandler;
      _workerSnapshotHandler = (m: any) => {
        try {
          if (m && m.state) {
            state = m.state;
            try {
              (state as any).shipMap = new Map<number, any>();
              state.teamCounts = { red: 0, blue: 0 };
              for (const s of (state.ships || [])) if (s && typeof s.id !== 'undefined') { (state as any).shipMap.set(s.id, s); try { const t = String((s as any).team || ''); state.teamCounts[t] = (state.teamCounts[t] || 0) + 1; } catch (e) {} }
            } catch (e) {}
            // Render the freshly-received snapshot so visuals reflect the
            // worker-applied AI+physics immediately.
            try {
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
                } catch (e) {
                  // swallow render errors
                }
              }
            } catch (e) {}
          }
        } catch (e) {}
      };
      // replace the handler on the worker
      simWorker.on && simWorker.off && simWorker.off("snapshot", _origWorkerSnapshotHandler);
      simWorker.on && simWorker.on("snapshot", _workerSnapshotHandler);

      _workerReinforcementsHandler = (m: any) => {
        emit("reinforcements", m);
      };
      simWorker.on &&
        simWorker.on("reinforcements", _workerReinforcementsHandler);
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
        simWorker = null;
      }
    } catch (e) {}
    workerReady = false;
    workerReadyCbs.length = 0;
    // Dispose renderer assets if possible
    if (renderer && typeof renderer.dispose === "function") {
      try {
        renderer.dispose();
      } catch (e) {}
    }
    // Clear asset references in GameState
    starCanvas = null;
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
      try { (state as any).shipMap && (state as any).shipMap.set(ship.id, ship); } catch (e) {}
  try { updateTeamCount(state, undefined, String(ship.team)); } catch (e) {}
      return ship;
    } catch (e) {
      return null;
    }
  }

  // Fleet formation (config-driven)
  function formFleets() {
    try {
      // Remove all ships
  // Clear ships and reset counts
  state.ships.length = 0;
  try { (state as any).shipMap && (state as any).shipMap.clear(); } catch (e) {}
  try { state.teamCounts = { red: 0, blue: 0 }; } catch (e) {}
      // Use makeInitialFleets from teamsConfig (static import)
      const bounds = SIM.bounds;
      const seed = Math.floor(srandom() * 0xffffffff) >>> 0;
      const ships = makeInitialFleets(seed, bounds, createShip);
      for (const ship of ships) {
        state.ships.push(ship);
        try { (state as any).shipMap && (state as any).shipMap.set(ship.id, ship); } catch (e) {}
        try { updateTeamCount(state, undefined, ship.team); } catch (e) {}
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
      teamCounts: { ...(state.teamCounts || {}) },
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
  // Build a canonical GameState using makeInitialState to ensure assetPool exists
  const base = makeInitialState();
  (base as any).t = 0;
  (base as any).ships = ships;
  (base as any).bullets = bullets;
  (base as any).explosions = [];
  (base as any).shieldHits = [];
  (base as any).healthHits = [];
  (base as any).particles = particles;
  (base as any).stars = stars;
  (base as any).flashes = flashes;
  (base as any).shieldFlashes = shieldFlashes;
  (base as any).healthFlashes = healthFlashes;
  (base as any).starCanvas = starCanvas || undefined;
  const state: GameState = base as any;
  // Populate shipMap from backing ships array for O(1) lookups
  try {
    (state as any).shipMap = new Map<number, any>();
    for (const s of (state.ships || [])) {
      if (s && typeof s.id !== 'undefined') (state as any).shipMap.set(s.id, s);
    }
  } catch (e) {}
  // (Previously exposed state globally via _lastGameState for legacy helpers.)
  // We now pass `state` explicitly to pooling helpers to avoid global state.
  evaluateReinforcement(dt, state);
  try {
    simulateStep(state, dt, SIM.bounds);
  } catch (e) {}
  for (const ex of state.explosions) {
    if (ex && typeof ex === "object") flashes.push(ex);
    try {
      const count = 12;
      for (let i = 0; i < count; i++) {
        const ang = srandom() * Math.PI * 2;
        const sp = 30 + srandom() * 90;
        acquireParticle(state, (ex as any).x || 0, (ex as any).y || 0, {
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
    if (h && typeof h === "object") shieldFlashes.push(h);
  }
  for (const h of state.healthHits) {
    if (h && typeof h === "object") healthFlashes.push(h);
  }
  // No global state to clear; callers should pass `state` explicitly to helpers.
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
