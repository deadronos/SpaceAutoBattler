// gamemanager.ts - full TypeScript port of gamemanager.js
import { makeInitialState, createShip, createBullet, type Ship, type Bullet } from './entities.js';
import { simulateStep, SIM_DT_MS } from './simulate.js';
import { srand, srandom, srange } from './rng.js';
import { getDefaultBounds } from './config/displayConfig.js';
import { createSimWorker } from './createSimWorker.js';
import { SHIELD, HEALTH, EXPLOSION, STARS } from './config/gamemanagerConfig.js';

export const ships: Ship[] = [];
export const bullets: Bullet[] = [];
export const particles: any[] = [];
export const stars: any[] = [];
export let starCanvas: any = null;
export const flashes: any[] = [];
export const shieldFlashes: any[] = [];
export const healthFlashes: any[] = [];
export const particlePool: any[] = [];

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
    stars: { twinkle: 'boolean', redrawInterval: 'number' }
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
  } else {
    p = new Particle(x, y, opts.vx || 0, opts.vy || 0, opts.ttl || 1, opts.color || '#fff', opts.size || 2);
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
  try { initStars({ stars }, 800, 600, 140); } catch (e) { /* ignore */ }
  try { if (!config.stars || !config.stars.twinkle) createStarCanvas({ stars }, 800, 600); } catch (e) { /* ignore */ }
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
    ships.push(createShip('fighter', 100, 100, 'red'));
    ships.push(createShip('fighter', 700, 500, 'blue'));
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
    flashes.push(Object.assign({}, ex));
    try {
      const count = 12; const ttl = 0.6; const color = 'rgba(255,200,100,0.95)'; const size = 3;
      for (let i = 0; i < count; i++) {
        const ang = srandom() * Math.PI * 2;
        const sp = 30 + srandom() * 90;
        const vx = Math.cos(ang) * sp; const vy = Math.sin(ang) * sp;
        acquireParticle(ex.x || 0, ex.y || 0, { vx, vy, ttl, color, size });
      }
    } catch (e) {}
  }

  // shield hits -> shieldFlashes + particles
  for (const h of state.shieldHits || []) {
    shieldFlashes.push(Object.assign({}, h, { ttl: config.shield.ttl, life: config.shield.ttl, spawned: true }));
    try {
      const cfg = config.shield || {};
      const cnt = cfg.particleCount || 6; const ttl = cfg.particleTTL || 0.35; const color = cfg.particleColor || 'rgba(160,200,255,0.9)'; const size = cfg.particleSize || 2;
      for (let i = 0; i < cnt; i++) {
        const ang = srandom() * Math.PI * 2; const sp = 10 + srandom() * 40; const vx = Math.cos(ang) * sp; const vy = Math.sin(ang) * sp;
        acquireParticle(h.hitX || h.x || 0, h.hitY || h.y || 0, { vx, vy, ttl, color, size });
      }
    } catch (e) {}
  }

  // health hits -> healthFlashes + particles
  for (const h of state.healthHits || []) {
    healthFlashes.push(Object.assign({}, h, { ttl: config.health.ttl, life: config.health.ttl, spawned: true }));
    try {
      const cfg = config.health || {};
      const cnt = cfg.particleCount || 8; const ttl = cfg.particleTTL || 0.6; const color = cfg.particleColor || 'rgba(255,120,80,0.95)'; const size = cfg.particleSize || 2;
      for (let i = 0; i < cnt; i++) {
        const ang = srandom() * Math.PI * 2; const sp = 20 + srandom() * 50; const vx = Math.cos(ang) * sp; const vy = Math.sin(ang) * sp;
        acquireParticle(h.hitX || h.x || 0, h.hitY || h.y || 0, { vx, vy, ttl, color, size });
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

  return { ships, bullets, particles, flashes: flashes, shieldFlashes, healthFlashes, stars, starCanvas };
}

export function createGameManager({ renderer, canvas, seed = 12345 } : any = {}) {
  let state = makeInitialState();
  let running = false; let score = { red: 0, blue: 0 };
  const bounds = getDefaultBounds();
  srand(seed);
  let simWorker: any = null;
  try {
    simWorker = createSimWorker(new URL('./simWorker.js', import.meta.url).href);
    simWorker.on('ready', () => console.log('sim worker ready'));
    simWorker.on('snapshot', (m: any) => { if (m && m.state) state = m.state; });
    simWorker.on('error', (m: any) => console.error('sim worker error', m));
    simWorker.post({ type: 'init', seed, bounds, simDtMs: SIM_DT_MS, state });
  } catch (e) { simWorker = null; }

  function step(dtSeconds: number) {
    // basic AI & movement
    for (const s of state.ships) {
      s.vx += (srange(-1, 1) * 10) * dtSeconds; s.vy += (srange(-1, 1) * 10) * dtSeconds;
      if (Math.random() < 0.01) {
        const b = createBullet(s.x, s.y, (Math.random() - 0.5) * 200, (Math.random() - 0.5) * 200, s.team, s.id, s.cannons?.[0]?.damage || 3, 2.0);
        if (simWorker) simWorker.post({ type: 'command', cmd: 'spawnShipBullet', args: { bullet: b } });
        else state.bullets.push(b);
      }
    }

    if (simWorker) {
      simWorker.post({ type: 'snapshotRequest' });
    } else {
      simulateStep(state, dtSeconds, bounds);
    }

    while (state.explosions && state.explosions.length) {
      const e = state.explosions.shift();
      if (e.team === 'red') score.blue++; else score.red++;
    }
    if (renderer && typeof renderer.renderState === 'function') renderer.renderState(state);
  }

  let acc = 0; let last = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
  function runLoop() {
    if (!running) return;
    const now = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
    acc += now - last; last = now; if (acc > 250) acc = 250;
    while (acc >= SIM_DT_MS) { step(SIM_DT_MS / 1000); acc -= SIM_DT_MS; }
    requestAnimationFrame(runLoop);
  }

  return {
    start() { if (!running) { running = true; last = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now(); runLoop(); } },
    pause() { running = false; },
    reset() { state = makeInitialState(); score = { red: 0, blue: 0 }; },
    isRunning() { return running; },
    spawnShip(color = 'red') { const x = Math.random() * bounds.W; const y = Math.random() * bounds.H; state.ships.push(createShip('fighter', x, y, color)); },
    reseed(newSeed = Math.floor(Math.random() * 0xffffffff)) { srand(newSeed); },
    formFleets() { for (let i = 0; i < 5; i++) { state.ships.push(createShip('fighter', 100 + i * 20, 100 + i * 10, 'red')); state.ships.push(createShip('fighter', bounds.W - 100 - i * 20, bounds.H - 100 - i * 10, 'blue')); } },
    snapshot() { return { ships: state.ships.slice(), bullets: state.bullets.slice(), t: state.t }; },
    score,
    _internal: { state, bounds }
  };
}

export { setShipConfig, getShipConfig } from './config/entitiesConfig.js';

export default { reset, simulate, processStateEvents, evaluateReinforcement, ships, bullets } as any;
