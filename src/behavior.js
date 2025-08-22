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
    const dmg = typeof c.damage === 'number' ? c.damage : 3;
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

export function applySimpleAI(state, dt, bounds = { W: 800, H: 600 }) {
  if (!state || !Array.isArray(state.ships)) return;
  for (const s of state.ships) {
    // Steering towards nearest enemy
    const enemy = findNearestEnemy(state, s);
    if (enemy) {
      // Accelerate towards enemy using ship.accel if present
      const accel = typeof s.accel === 'number' ? s.accel : 100;
      const aim = aimWithSpread(s, enemy, 0); // no spread for steering
      s.vx = (s.vx || 0) + aim.x * accel * dt;
      s.vy = (s.vy || 0) + aim.y * accel * dt;
      // Fire if off cooldown
      tryFire(state, s, enemy, dt);
    } else {
      // Idle drift with tiny deterministic noise
      s.vx = (s.vx || 0) + (srange(-1, 1) * 8) * dt;
      s.vy = (s.vy || 0) + (srange(-1, 1) * 8) * dt;
    }
    // Clamp max speed to keep motion sane
    const maxSpeed = 160;
    clampSpeed(s, maxSpeed);
  }
}

export default { applySimpleAI };
