// behavior.js - deterministic, simple AI for steering and firing
// Uses seeded RNG for any randomness so results are reproducible.
import { srandom, srange } from './rng.js';
import { createBullet } from './entities.js';

// Small helpers
function len2(vx, vy) { return vx*vx + vy*vy; }
function clampSpeed(s, max) {
  const v2 = len2(s.vx || 0, s.vy || 0);
  const max2 = max * max;
  if (v2 > max2 && v2 > 0) {
    const inv = max / Math.sqrt(v2);
    s.vx *= inv; s.vy *= inv;
  }
}

function findNearestEnemy(state, ship) {
  let best = null; let bestD2 = Infinity;
  for (const other of state.ships) {
    if (other === ship) continue;
    if (other.team === ship.team) continue;
    const dx = other.x - ship.x; const dy = other.y - ship.y;
    const d2 = dx*dx + dy*dy;
    if (d2 < bestD2) { bestD2 = d2; best = other; }
  }
  return best;
}

// Aim vector with tiny deterministic spread
function aimWithSpread(from, to, spread = 0) {
  let dx = to.x - from.x; let dy = to.y - from.y;
  const d = Math.hypot(dx, dy) || 1;
  dx /= d; dy /= d;
  if (spread > 0) {
    const ang = Math.atan2(dy, dx);
    const jitter = (srange(-spread, spread));
    const na = ang + jitter;
    return { x: Math.cos(na), y: Math.sin(na) };
  }
  return { x: dx, y: dy };
}

// Fire cannons using per-cannon cooldowns based on `rate` (shots/sec)
function tryFire(state, ship, target, dt) {
  if (!Array.isArray(ship.cannons) || ship.cannons.length === 0) return;
  for (const c of ship.cannons) {
    // prepare cooldown storage on the cannon instance
    if (typeof c.__cd !== 'number') c.__cd = 0;
    c.__cd -= dt;
    if (c.__cd > 0) continue;
    // simple LOS/aim check — always fire if we have a target
    const spread = typeof c.spread === 'number' ? c.spread : 0;
    const dir = aimWithSpread(ship, target, spread);
    const speed = typeof c.muzzleSpeed === 'number' ? c.muzzleSpeed : 240;
  // Prefer per-cannon damage; fall back to ship-level damage (`ship.damage` or legacy `ship.dmg`) if present,
  // otherwise use default 3.
  const dmg = (typeof c.damage === 'number') ? c.damage : (typeof ship.damage === 'number' ? ship.damage : (typeof ship.dmg === 'number' ? ship.dmg : 3));
    const ttl = typeof c.bulletTTL === 'number' ? c.bulletTTL : 2.0;
    const radius = typeof c.bulletRadius === 'number' ? c.bulletRadius : 1.5;
    const vx = dir.x * speed;
    const vy = dir.y * speed;
    const b = Object.assign(
      createBullet(ship.x, ship.y, vx, vy, ship.team, ship.id, dmg, ttl),
      { radius }
    );
    state.bullets.push(b);
    const rate = (typeof c.rate === 'number' && c.rate > 0) ? c.rate : 1;
    c.__cd = 1 / rate;
  }
}

// Per-ship AI states: 'idle', 'engage', 'evade'
function ensureShipAiState(s) {
  if (!s.__ai) {
    s.__ai = { state: 'idle', decisionTimer: 0, targetId: null };
  }
  return s.__ai;
}

function chooseNewTarget(state, ship) {
  const enemies = (state.ships || []).filter((sh) => sh && sh.team !== ship.team);
  if (!enemies.length) return null;
  const idx = Math.floor(srandom() * enemies.length);
  return enemies[idx];
}

function steerAway(s, tx, ty, accel, dt) {
  const dx = (s.x || 0) - tx; const dy = (s.y || 0) - ty;
  const d = Math.hypot(dx, dy) || 1;
  const nx = dx / d; const ny = dy / d;
  s.vx = (s.vx || 0) + nx * accel * dt;
  s.vy = (s.vy || 0) + ny * accel * dt;
}

export function applySimpleAI(state, dt, bounds = { W: 800, H: 600 }) {
  if (!state || !Array.isArray(state.ships)) return;
  for (const s of state.ships) {
    const ai = ensureShipAiState(s);
    ai.decisionTimer = Math.max(0, (ai.decisionTimer || 0) - dt);

    let target = null;
    if (ai.targetId != null) target = (state.ships || []).find(sh => sh && sh.id === ai.targetId);
    if (!target) target = chooseNewTarget(state, s);
    if (target) ai.targetId = target.id;

    const accel = typeof s.accel === 'number' ? s.accel : 100;
    const maxSpeed = 160;

    if (!target) {
      s.vx = (s.vx || 0) + (srange(-1, 1) * 8) * dt;
      s.vy = (s.vy || 0) + (srange(-1, 1) * 8) * dt;
      ai.state = 'idle';
    } else {
      if (ai.decisionTimer <= 0) {
        const hpFrac = ((s.hp || 0) / Math.max(1, (s.maxHp || 1)));
        const rnd = srandom();
        if (hpFrac < 0.35 || rnd < 0.15) ai.state = 'evade';
        else if (rnd < 0.85) ai.state = 'engage'; else ai.state = 'idle';
        ai.decisionTimer = 0.5 + srandom() * 1.5;
      }

      if (ai.state === 'engage') {
        const aim = aimWithSpread(s, target, 0.05);
        s.vx = (s.vx || 0) + aim.x * accel * dt;
        s.vy = (s.vy || 0) + aim.y * accel * dt;
        tryFire(state, s, target, dt);
      } else if (ai.state === 'evade') {
        steerAway(s, target.x || 0, target.y || 0, accel * 0.8, dt);
        const ang = Math.atan2((s.vy || 0), (s.vx || 0));
        const perp = ang + (Math.PI / 2) * (srandom() < 0.5 ? 1 : -1);
        s.vx += Math.cos(perp) * accel * 0.2 * dt; s.vy += Math.sin(perp) * accel * 0.2 * dt;
      } else {
        s.vx = (s.vx || 0) + (srange(-0.5, 0.5) * 6) * dt;
        s.vy = (s.vy || 0) + (srange(-0.5, 0.5) * 6) * dt;
      }
    }
    clampSpeed(s, maxSpeed);
  }
}

// Debug helper
export function getShipAiState(ship) {
  if (!ship || !ship.__ai) return null;
  // return a copy but omit targetId to avoid test flakiness due to global id counters
  const { targetId, ...rest } = ship.__ai;
  return Object.assign({}, rest);
}

export default { applySimpleAI, getShipAiState };
