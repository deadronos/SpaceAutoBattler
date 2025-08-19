import { srange, srangeInt, srand, unseed } from './rng.js';
import { simulateStep } from './simulate.js';
import { Ship, Team, spawnFleet } from './entities.js';
import { XP_PER_DAMAGE, KILL_XP_BASE, KILL_XP_PER_TARGET_LEVEL } from './progressionConfig.js';

// --- Utilities ---
const TAU = Math.PI * 2;
const randf = (min, max) => min + (max - min) * Math.random();
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// External UI hook - default noop, renderer or demo can override
let toast = (msg) => {
  if (typeof document !== 'undefined') {
    const t = document.getElementById('toast');
    if (t) {
      t.textContent = msg;
      t.classList.add('show');
      setTimeout(() => t.classList.remove('show'), 1400);
    }
  }
};
export function setToast(fn) { toast = fn; }

// Starfield
const stars = [];
export function initStars() {
  stars.length = 0;
  const layers = [0.2, 0.5, 1.0];
  const W = typeof window !== 'undefined' ? window.innerWidth : 1024;
  const H = typeof window !== 'undefined' ? window.innerHeight : 768;
  for (const depth of layers) {
    for (let i = 0; i < 120; i++) {
      stars.push({ x: randf(0, W), y: randf(0, H), r: randf(0.3, 1.8) * depth, d: depth, tw: randf(0.4, 1), phase: randf(0, TAU) });
    }
  }
}
initStars();

// Particle pooling
const particlePool = [];
const particles = [];
class Particle {
  constructor(x, y, vx, vy, life, color) { this.x = x; this.y = y; this.vx = vx; this.vy = vy; this.life = life; this.max = life; this.color = color; }
  update(dt) { this.x += this.vx * dt; this.y += this.vy * dt; this.vx *= Math.pow(0.9, dt * 60); this.vy *= Math.pow(0.9, dt * 60); this.life -= dt; }
}
function acquireParticle(x, y, vx, vy, life, color) { let p; if (particlePool.length > 0) { p = particlePool.pop(); p.x = x; p.y = y; p.vx = vx; p.vy = vy; p.life = life; p.max = life; p.color = color; } else { p = new Particle(x, y, vx, vy, life, color); } particles.push(p); return p; }
function releaseParticle(p) { if (particlePool.length < 2000) particlePool.push(p); }

// Visual flashes and hit trackers
const flashes = [];
const shieldFlashes = [];
const healthFlashes = [];

// Game world state
const ships = [];
const bullets = [];

// Reinforcement / evaluation
let reinforcementIntervalSeconds = 0;
let reinforcementCheckAccumulator = { [Team.RED]: 0, [Team.BLUE]: 0 };
const reinforcementCooldowns = { [Team.RED]: 0, [Team.BLUE]: 0 };
function resetReinforcementCooldowns() { reinforcementCooldowns[Team.RED] = 0; reinforcementCooldowns[Team.BLUE] = 0; }
export function setReinforcementInterval(seconds) { reinforcementIntervalSeconds = Number(seconds) || 0; reinforcementCheckAccumulator[Team.RED] = 0; reinforcementCheckAccumulator[Team.BLUE] = 0; }
export function getReinforcementInterval() { return reinforcementIntervalSeconds; }

// Continuous checkbox fallback for tests (renderer may attach a real one)
let continuousCheckbox = null;
export function setContinuousCheckbox(el) { continuousCheckbox = el; }

function handleReinforcement(dt, team = null) {
  if (!continuousCheckbox || !continuousCheckbox.checked) return;
  const lowThreshold = 2;
  const types = ['frigate','corvette','destroyer','carrier'];
  const spawnFor = (team, n) => {
    for (let i = 0; i < n; i++) {
      const t = types[srangeInt(0, types.length - 1)];
      const W = typeof window !== 'undefined' ? window.innerWidth : 1024;
      const H = typeof window !== 'undefined' ? window.innerHeight : 768;
      const x = team === Team.RED ? srange(40, Math.max(120, W*0.35)) : srange(Math.max(W*0.65, W-240), W-40);
      const y = srange(80, Math.max(120, H-80));
      ships.push(new Ship(team, x, y, t));
    }
  };
  const evalTeam = (t) => {
    const alive = ships.filter(s => s.alive && s.team === t).length;
    if (alive < lowThreshold) {
      reinforcementCooldowns[t] -= dt;
      if (reinforcementCooldowns[t] <= 0) {
        const count = srangeInt(1,6);
        spawnFor(t, count);
        reinforcementCooldowns[t] = srange(3,8);
        toast(`Reinforcements: +${count} ${t===Team.RED? 'Red':'Blue'}`);
      }
    }
  };
  if (team === null) { evalTeam(Team.RED); evalTeam(Team.BLUE); } else { evalTeam(team); }
}

// Expose reset and simulate
export function reset(seedValue=null) {
  ships.length = 0; bullets.length = 0; particles.length = 0; flashes.length = 0; shieldFlashes.length = 0; healthFlashes.length = 0;
  if (seedValue !== null) { srand(seedValue>>>0); toast(`Seed set to ${seedValue>>>0}`); } else { try { unseed(); } catch(e){} }
  const W = typeof window !== 'undefined' ? window.innerWidth : 1024;
  const H = typeof window !== 'undefined' ? window.innerHeight : 768;
  ships.push(...spawnFleet(Team.RED, 12, W*0.25, H*0.5));
  ships.push(...spawnFleet(Team.BLUE, 12, W*0.75, H*0.5));
}

// --- Strategy hooks (configurable for tests) ---
// carrierLaunchStrategy(ship, ships, dt) -> array of Ships to spawn (or empty)
let carrierLaunchStrategy = (carrier, shipsList, dt) => {
  const spawned = [];
  carrier.launchCooldown -= dt;
  if (carrier.launchCooldown <= 0) {
    const canLaunch = (Array.isArray(carrier.activeFighters) ? carrier.activeFighters.length : 0) < (carrier.maxFighters || 6);
    if (canLaunch) {
      const toLaunch = Math.max(1, Math.floor(carrier.launchAmount || 1));
      for (let k = 0; k < toLaunch; k++) {
        if (carrier.activeFighters.length >= (carrier.maxFighters || 6)) break;
        const a = srange(0, TAU);
        const dist = carrier.radius + 12 + srange(4,12);
        const fx = carrier.x + Math.cos(a) * dist; const fy = carrier.y + Math.sin(a) * dist;
        const f = new Ship(carrier.team, fx, fy, 'fighter');
        const spd = srange(40,120);
        f.vx = Math.cos(a) * spd + (carrier.vx || 0) * 0.2;
        f.vy = Math.sin(a) * spd + (carrier.vy || 0) * 0.2;
        f.ownerCarrier = carrier.id;
        carrier.activeFighters.push(f.id);
        spawned.push(f);
      }
    }
    carrier.launchCooldown = srange(2.5, 6.0);
  }
  return spawned;
};
export function setCarrierLaunchStrategy(fn) { carrierLaunchStrategy = fn; }

// reinforcementStrategy(dt, ships) -> void (may spawn reinforcements)
let reinforcementStrategy = (dt, shipsList) => { handleReinforcement(dt); };
export function setReinforcementStrategy(fn) { reinforcementStrategy = fn; }

// spawnCompositionStrategy(team, count, x, y) -> array of Ships
let spawnCompositionStrategy = (team, count, x, y) => spawnFleet(team, count, x, y);
export function setSpawnCompositionStrategy(fn) { spawnCompositionStrategy = fn; }

export function evaluateReinforcement(dt) {
  if (reinforcementIntervalSeconds <= 0) { handleReinforcement(dt); return; }
  reinforcementCheckAccumulator[Team.RED] += dt; reinforcementCheckAccumulator[Team.BLUE] += dt;
  if (reinforcementCheckAccumulator[Team.RED] >= reinforcementIntervalSeconds) { handleReinforcement(reinforcementCheckAccumulator[Team.RED], Team.RED); reinforcementCheckAccumulator[Team.RED] = 0; }
  if (reinforcementCheckAccumulator[Team.BLUE] >= reinforcementIntervalSeconds) { handleReinforcement(reinforcementCheckAccumulator[Team.BLUE], Team.BLUE); reinforcementCheckAccumulator[Team.BLUE] = 0; }
}

export function simulate(dt, W, H) {
  for (const s of stars) { s.phase += dt * 0.8 * s.d; }

  // Carrier launch decisions: spawn fighters when carriers are ready. This was
  // previously inside simulateStep but belongs to the game manager (higher
  // level decision logic).
  for (const s of ships) {
    if (!s.alive || !s.isCarrier) continue;
    const spawned = carrierLaunchStrategy(s, ships, dt);
    if (Array.isArray(spawned) && spawned.length) {
      for (const f of spawned) ships.push(f);
    }
  }

  for (const s of ships) { s.update(dt, ships); }
  for (let i=bullets.length-1;i>=0;i--) { const b = bullets[i]; b.update(dt); if (!b.alive()) { bullets.splice(i,1); continue; } }

  const shieldHits = [];
  const state = { ships, bullets, score: { red:0, blue:0 }, particles, explosions: [], shieldHits };
  simulateStep(state, dt, { W, H });
  if (state.explosions && state.explosions.length) {
    for (const e of state.explosions) {
      flashes.push({ x: e.x, y: e.y, r: 2, life: .25, team: e.team });
      for (let i=0;i<20;i++) { const a = srange(0,TAU); const sp = srange(40,220); acquireParticle(e.x, e.y, Math.cos(a)*sp, Math.sin(a)*sp, randf(.2,1), `rgba(255,255,255,$a)`); }
    }
  }
  if (Array.isArray(state.shieldHits) && state.shieldHits.length) {
    for (const h of state.shieldHits) {
      const ship = ships.find(s => s.id === h.id);
      const shipX = ship ? ship.x : h.hitX;
      const shipY = ship ? ship.y : h.hitY;
      flashes.push({ x: shipX, y: shipY, r: 6 + Math.min(12, h.amount), life: 0.12, team: h.team, shieldHit: true });
      for (let i=0;i<6;i++) { const a = srange(0,TAU); const sp = srange(40,120); acquireParticle(h.hitX, h.hitY, Math.cos(a)*sp, Math.sin(a)*sp, randf(.12,0.4), 'rgba(200,230,255,$a)'); }
      if (ship) { const ang = Math.atan2(h.hitY - shipY, h.hitX - shipX); shieldFlashes.push({ id: ship.id, angle: ang, life: 0.22, amount: h.amount }); }
    }
  }
  if (Array.isArray(state.healthHits) && state.healthHits.length) {
    for (const hh of state.healthHits) { const ship = ships.find(s => s.id === hh.id); if (ship) { healthFlashes.push({ id: ship.id, life: 0.45, amount: hh.amount }); } }
  }

  // Process damageEvents and killEvents emitted by simulateStep. This moves
  // XP awarding, scoring, and carrier cleanup decisions into the manager.
  if (Array.isArray(state.damageEvents) && state.damageEvents.length) {
    for (const ev of state.damageEvents) {
      if (ev && ev.ownerId != null && typeof ev.dmg === 'number') {
        const owner = ships.find(s => s.id === ev.ownerId);
        if (owner) owner.gainXp(ev.dmg * XP_PER_DAMAGE);
      }
    }
  }
  if (Array.isArray(state.killEvents) && state.killEvents.length) {
    for (const k of state.killEvents) {
      if (!k) continue;
      // update score by killer team (if provided)
      if (k.killerTeam === Team.RED) state.score.red++; else if (k.killerTeam === Team.BLUE) state.score.blue++;
      // award kill XP
      if (k.killerId != null) {
        const owner = ships.find(s => s.id === k.killerId);
        if (owner) owner.gainXp(KILL_XP_BASE + ((k.level || 1) * KILL_XP_PER_TARGET_LEVEL));
      }
      // carrier/fighter cleanup: if a fighter died, remove from owner's active list
      if (k.type === 'fighter' && typeof k.ownerCarrier === 'number') {
        const owner = ships.find(s => s.id === k.ownerCarrier);
        if (owner && Array.isArray(owner.activeFighters)) {
          const idx = owner.activeFighters.indexOf(k.id);
          if (idx >= 0) owner.activeFighters.splice(idx, 1);
        }
      }
      // if a carrier died, clear ownerCarrier on fighters and clear any active list
      if (k.type === 'carrier') {
        const carrierId = k.id;
        for (const s of ships) {
          if (!s.alive) continue;
          if (s.type === 'fighter' && s.ownerCarrier === carrierId) s.ownerCarrier = null;
        }
        const carrier = ships.find(s => s.id === carrierId);
        if (carrier && Array.isArray(carrier.activeFighters)) carrier.activeFighters.length = 0;
      }
    }
  }

  // use configurable reinforcement strategy
  reinforcementStrategy(dt, ships);

  for (let i=particles.length-1;i>=0;i--) { const p=particles[i]; p.update(dt); if (p.life<=0) { particles.splice(i,1); releaseParticle(p); } }
  for (let i=flashes.length-1;i>=0;i--) { const f=flashes[i]; f.life -= dt; f.r += 600*dt; if (f.life<=0) flashes.splice(i,1); }
  for (let i=shieldFlashes.length-1;i>=0;i--) { const sf=shieldFlashes[i]; sf.life -= dt; if (sf.life<=0) shieldFlashes.splice(i,1); }
  for (let i=healthFlashes.length-1;i>=0;i--) { const hf=healthFlashes[i]; hf.life -= dt; if (hf.life<=0) healthFlashes.splice(i,1); }

  return { ships, bullets, particles, flashes, shieldFlashes, healthFlashes, stars };
}

/**
 * Process event arrays produced by `simulateStep` for an arbitrary state
 * object. This is intended for tests or callers that use `simulateStep` and
 * need the higher-level decisions (XP, scoring, carrier launches) applied.
 *
 * state: { ships, bullets, score, particles, explosions, shieldHits, healthHits, damageEvents, killEvents }
 */
export function processStateEvents(state, dt = 0) {
  if (!state || !Array.isArray(state.ships)) return;
  // Carrier launches for the provided state
  for (const s of state.ships) {
    if (!s.alive || !s.isCarrier) continue;
    const spawned = carrierLaunchStrategy(s, state.ships, dt);
    if (Array.isArray(spawned) && spawned.length) {
      for (const f of spawned) state.ships.push(f);
    }
  }

  // Process damage events
  if (Array.isArray(state.damageEvents) && state.damageEvents.length) {
    for (const ev of state.damageEvents) {
      if (ev && ev.ownerId != null && typeof ev.dmg === 'number') {
        const owner = state.ships.find(s => s.id === ev.ownerId);
        if (owner) owner.gainXp(ev.dmg * XP_PER_DAMAGE);
      }
    }
  }

  // Process kill events
  if (Array.isArray(state.killEvents) && state.killEvents.length) {
    for (const k of state.killEvents) {
      if (!k) continue;
      if (!state.score) state.score = { red: 0, blue: 0 };
      if (k.killerTeam === Team.RED) state.score.red++; else if (k.killerTeam === Team.BLUE) state.score.blue++;
      if (k.killerId != null) {
        const owner = state.ships.find(s => s.id === k.killerId);
        if (owner) owner.gainXp(KILL_XP_BASE + ((k.level || 1) * KILL_XP_PER_TARGET_LEVEL));
      }
      if (k.type === 'fighter' && typeof k.ownerCarrier === 'number') {
        const owner = state.ships.find(s => s.id === k.ownerCarrier);
        if (owner && Array.isArray(owner.activeFighters)) {
          const idx = owner.activeFighters.indexOf(k.id);
          if (idx >= 0) owner.activeFighters.splice(idx, 1);
        }
      }
      if (k.type === 'carrier') {
        const carrierId = k.id;
        for (const s of state.ships) {
          if (!s.alive) continue;
          if (s.type === 'fighter' && s.ownerCarrier === carrierId) s.ownerCarrier = null;
        }
        const carrier = state.ships.find(s => s.id === carrierId);
        if (carrier && Array.isArray(carrier.activeFighters)) carrier.activeFighters.length = 0;
      }
    }
  }
}

// Export non-function symbols and utilities (functions already exported above)
export {
  clamp,
  stars,
  flashes,
  shieldFlashes,
  healthFlashes,
  particles,
  particlePool,
  acquireParticle,
  releaseParticle,
  Particle,
  ships,
  bullets,
  resetReinforcementCooldowns,
  handleReinforcement,
};
