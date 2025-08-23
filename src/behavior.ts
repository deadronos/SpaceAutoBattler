// behavior.ts - deterministic, simple AI for steering and firing
// Uses seeded RNG for any randomness so results are reproducible.
import { srandom, srange } from './rng';
import { createBullet } from './entities';

type ShipLike = {
  id?: number;
  x?: number; y?: number;
  vx?: number; vy?: number;
  team?: string;
  hp?: number; maxHp?: number;
  cannons?: any[];
  accel?: number; radius?: number; turnRate?: number;
  damage?: number; dmg?: number;
  __ai?: any;
};

type State = { ships: ShipLike[]; bullets: any[] };

function len2(vx: number, vy: number) { return vx*vx + vy*vy; }
function clampSpeed(s: ShipLike, max: number) {
  const v2 = len2(s.vx || 0, s.vy || 0);
  const max2 = max * max;
  if (v2 > max2 && v2 > 0) {
    const inv = max / Math.sqrt(v2);
    s.vx = (s.vx || 0) * inv;
    s.vy = (s.vy || 0) * inv;
  }
}

function aimWithSpread(from: ShipLike, to: ShipLike, spread = 0) {
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

function tryFire(state: State, ship: ShipLike, target: ShipLike, dt: number) {
  if (!Array.isArray(ship.cannons) || ship.cannons.length === 0) return;
  for (const c of ship.cannons) {
    if (typeof c.__cd !== 'number') c.__cd = 0;
    c.__cd -= dt;
    if (c.__cd > 0) continue;
    const spread = typeof c.spread === 'number' ? c.spread : 0;
    const dir = aimWithSpread(ship, target, spread);
    const speed = typeof c.muzzleSpeed === 'number' ? c.muzzleSpeed : 240;
    const dmg = (typeof c.damage === 'number') ? c.damage : (typeof ship.damage === 'number' ? ship.damage : (typeof ship.dmg === 'number' ? ship.dmg : 3));
    const ttl = typeof c.bulletTTL === 'number' ? c.bulletTTL : 2.0;
    const radius = typeof c.bulletRadius === 'number' ? c.bulletRadius : 1.5;
    const vx = dir.x * speed; const vy = dir.y * speed;
    const b = Object.assign(
      createBullet(ship.x || 0, ship.y || 0, vx, vy, ship.team || 'red', ship.id || null, dmg, ttl),
      { radius }
    );
    state.bullets.push(b);
    const rate = (typeof c.rate === 'number' && c.rate > 0) ? c.rate : 1;
    c.__cd = 1 / rate;
  }
}

function ensureShipAiState(s: ShipLike) {
  if (!s.__ai) {
    s.__ai = { state: 'idle', decisionTimer: 0, targetId: null };
  }
  return s.__ai;
}

function chooseNewTarget(state: State, ship: ShipLike) {
  const enemies = (state.ships || []).filter((sh) => sh && sh.team !== ship.team);
  if (!enemies.length) return null;
  const idx = Math.floor(srandom() * enemies.length);
  return enemies[idx];
}

function steerAway(s: ShipLike, tx: number, ty: number, accel: number, dt: number) {
  const dx = (s.x || 0) - tx; const dy = (s.y || 0) - ty;
  const d = Math.hypot(dx, dy) || 1;
  const nx = dx / d; const ny = dy / d;
  s.vx = (s.vx || 0) + nx * accel * dt;
  s.vy = (s.vy || 0) + ny * accel * dt;
}

export function applySimpleAI(state: State, dt: number, bounds = { W: 800, H: 600 }) {
  if (!state || !Array.isArray(state.ships)) return;
  for (const s of state.ships) {
    const ai = ensureShipAiState(s);
    ai.decisionTimer = Math.max(0, (ai.decisionTimer || 0) - dt);

    let target: ShipLike | null = null;
    if (ai.targetId != null) target = (state.ships || []).find(sh => sh && sh.id === ai.targetId) || null;
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
        s.vx = (s.vx || 0) + Math.cos(perp) * accel * 0.2 * dt;
        s.vy = (s.vy || 0) + Math.sin(perp) * accel * 0.2 * dt;
      } else {
        s.vx = (s.vx || 0) + (srange(-0.5, 0.5) * 6) * dt;
        s.vy = (s.vy || 0) + (srange(-0.5, 0.5) * 6) * dt;
      }
    }
    clampSpeed(s, maxSpeed);
  }
}

export function getShipAiState(ship: ShipLike) {
  if (!ship || !ship.__ai) return null;
  const { targetId, ...rest } = ship.__ai;
  return Object.assign({}, rest);
}

export default { applySimpleAI, getShipAiState };
