// behavior.ts - deterministic, simple AI for steering and firing (TypeScript)
import { srange } from './rng';
import { createBullet, type Ship } from './entities';

type State = { ships: any[]; bullets: any[] };

function len2(vx: number, vy: number) { return vx*vx + vy*vy; }
function clampSpeed(s: any, max: number) {
  const v2 = len2(s.vx || 0, s.vy || 0);
  const max2 = max * max;
  if (v2 > max2 && v2 > 0) {
    const inv = max / Math.sqrt(v2);
    s.vx *= inv; s.vy *= inv;
  }
}

function findNearestEnemy(state: State, ship: any) {
  let best: any = null; let bestD2 = Infinity;
  for (const other of state.ships) {
    if (other === ship) continue;
    if (other.team === ship.team) continue;
    const dx = (other.x || 0) - (ship.x || 0); const dy = (other.y || 0) - (ship.y || 0);
    const d2 = dx*dx + dy*dy;
    if (d2 < bestD2) { bestD2 = d2; best = other; }
  }
  return best;
}

function aimWithSpread(from: any, to: any, spread = 0) {
  let dx = (to.x || 0) - (from.x || 0); let dy = (to.y || 0) - (from.y || 0);
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

function tryFire(state: State, ship: any, target: any, dt: number) {
  const cannons: any[] = Array.isArray(ship.cannons) ? ship.cannons : [];
  for (const c of cannons) {
    if (typeof c.__cd !== 'number') c.__cd = 0;
    c.__cd -= dt;
    if (c.__cd > 0) continue;
    const spread = typeof c.spread === 'number' ? c.spread : 0;
    const dir = aimWithSpread(ship, target, spread);
    const speed = typeof c.muzzleSpeed === 'number' ? c.muzzleSpeed : 240;
    const dmg = typeof c.damage === 'number' ? c.damage : 3;
    const ttl = typeof c.bulletTTL === 'number' ? c.bulletTTL : 2.0;
    const radius = typeof c.bulletRadius === 'number' ? c.bulletRadius : 1.5;
    const vx = dir.x * speed; const vy = dir.y * speed;
    const b = Object.assign(
      createBullet(ship.x, ship.y, vx, vy, ship.team, ship.id, dmg, ttl),
      { radius }
    );
    state.bullets.push(b);
    const rate = (typeof c.rate === 'number' && c.rate > 0) ? c.rate : 1;
    c.__cd = 1 / rate;
  }
}

export function applySimpleAI(state: State, dt: number, _bounds: { W: number; H: number } = { W: 800, H: 600 }) {
  if (!state || !Array.isArray(state.ships)) return;
  for (const s of state.ships) {
    const enemy = findNearestEnemy(state, s);
    if (enemy) {
      const accel = typeof s.accel === 'number' ? s.accel : 100;
      const aim = aimWithSpread(s, enemy, 0);
      s.vx = (s.vx || 0) + aim.x * accel * dt;
      s.vy = (s.vy || 0) + aim.y * accel * dt;
      tryFire(state, s, enemy, dt);
    } else {
      // tiny deterministic drift when no enemy
      s.vx = (s.vx || 0) + (srange(-1, 1) * 8) * dt;
      s.vy = (s.vy || 0) + (srange(-1, 1) * 8) * dt;
    }
    clampSpeed(s, 160);
  }
}

export default { applySimpleAI };
