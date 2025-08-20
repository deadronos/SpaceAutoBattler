import { srand } from './rng.js';
import { createShip } from './entities.js';
import { simulateStep } from './simulate.js';

export const ships = [];
export const bullets = [];
export const particles = [];
export const stars = [];
export const flashes = [];
export const shieldFlashes = [];
export const healthFlashes = [];
export const particlePool = [];

// manager-level tuning config (particle/flash tuning)
export const config = {
  shield: { ttl: 0.4, particleCount: 6, particleTTL: 0.35, particleColor: 'rgba(160,200,255,0.9)', particleSize: 2 },
  health: { ttl: 0.75, particleCount: 8, particleTTL: 0.6, particleColor: 'rgba(255,120,80,0.95)', particleSize: 2 }
};

export function setManagerConfig(newCfg = {}) {
  // shallow merge top-level keys
  for (const k of Object.keys(newCfg)) { if (config[k]) Object.assign(config[k], newCfg[k]); }
}
export function getManagerConfig() { return config; }

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

export function reset(seedValue = null) {
  ships.length = 0; bullets.length = 0; particles.length = 0; stars.length = 0;
  flashes.length = 0; shieldFlashes.length = 0; healthFlashes.length = 0;
  _reinforcementAccumulator = 0;
  if (typeof seedValue === 'number') { _seed = seedValue >>> 0; srand(_seed); }
}

export function simulate(dt, W = 800, H = 600) {
  const state = { ships, bullets, particles, stars, explosions: [], shieldHits: [], healthHits: [] };
  evaluateReinforcement(dt);
  simulateStep(state, dt, { W, H });
  // merge emitted events into exported arrays for renderer
  flashes.push(...state.explosions);
  // wrap hits with TTL/life so renderer can persist them across frames
  for (const h of state.shieldHits) {
    shieldFlashes.push(Object.assign({}, h, { ttl: config.shield.ttl, life: config.shield.ttl, spawned: false }));
  }
  for (const h of state.healthHits) {
    healthFlashes.push(Object.assign({}, h, { ttl: config.health.ttl, life: config.health.ttl, spawned: false }));
  }
  return { ships, bullets, particles, flashes: flashes, shieldFlashes, healthFlashes, stars };
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
    ships.push(createShip({ x: 100, y: 100, team: 'red' }));
    ships.push(createShip({ x: 700, y: 500, team: 'blue' }));
  }
}

export function setReinforcementInterval(seconds) { _reinforcementInterval = seconds; }
export function getReinforcementInterval() { return _reinforcementInterval; }

export default { reset, simulate, processStateEvents, evaluateReinforcement, ships, bullets };
