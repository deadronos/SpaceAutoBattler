/*
  behavior.ts - deterministic, simple AI for steering and firing

  Developer notes (AI / GameManager contract)

  Overview
  - This module implements a small, deterministic AI used by the GameManager
    in main-thread simulation mode (when no sim worker is present) and by
    the worker simulation code. The AI is intentionally simple: per-ship
    finite-state behavior (idle, engage, evade), target selection, basic
    steering and firing logic.

  Determinism and RNG
  - The AI uses the seeded RNG helpers exported from `src/rng`:
      - `srandom()` returns a seeded pseudo-random [0,1) value
      - `srange(a,b)` returns a seeded pseudo-random value in [a,b)
  - Callers (tests and manager) must ensure the RNG seed is set via
    `srand(seed)` before running simulation steps for deterministic
    outcomes. The GameManager may also use a manager-local RNG for
    deterministic spawn behaviour; AI should only rely on `srandom()` and
    `srange()` for deterministic randomness.

  Per-ship AI
  - Each ship gets a lightweight `__ai` object stored on the ship:
      { state: 'idle'|'engage'|'evade', decisionTimer: number, targetId: any }
  - `applySimpleAI(state, dt, bounds)` updates each ship's velocity and may
    emit bullets into the provided `state.bullets` array (via createBullet).
  - The AI uses `chooseNewTarget(...)` which performs a seeded random pick
    among visible enemies (via `srandom()`), keeping behavior repeatable
    when seeded.

  Integration points with GameManager
  - GameManager calls `applySimpleAI(state, dt, bounds)` when running the
    simulation on the main thread (i.e., when no worker is used). The
    worker version implements the same logic to maintain parity.
  - The AI only mutates ship/bullet numeric properties; it must not touch
    rendering or DOM APIs (those are the renderer's responsibility).

  Reinforcements & Tests
  - Unit tests that assert deterministic behaviour should call `srand(seed)`
    before driving the simulation and, when available, call manager-level
    `reseed(seed)` to also align any manager-local RNG.
  - Use `createGameManager({ useWorker: false })` in tests to avoid worker
    timing nondeterminism when asserting AI outcomes.

  Debugging helpers
  - `getShipAiState(ship)` returns a shallow copy of a ship's `__ai` object
    (excluding `targetId`) to help assertions in tests and UI debugging.

  Keep this module focused on numeric simulation logic. Any UX-facing
  concerns (timing, delayed UI updates) should be handled outside of this
  module to keep tests deterministic and fast.
*/

// behavior.ts - deterministic, simple AI for steering and firing (TypeScript)
import { srange, srandom } from './rng';
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
  // Prefer per-cannon damage; fall back to ship-level damage (`ship.damage` or legacy `ship.dmg`) if present,
  // otherwise use default 3.
  const dmg = (typeof c.damage === 'number') ? c.damage : (typeof ship.damage === 'number' ? ship.damage : (typeof ship.dmg === 'number' ? ship.dmg : 3));
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

// Per-ship AI states: 'idle', 'engage', 'evade'
function ensureShipAiState(s: any) {
  if (!s.__ai) {
    s.__ai = { state: 'idle', decisionTimer: 0, targetId: null };
  }
  return s.__ai;
}

function chooseNewTarget(state: State, ship: any) {
  // find nearest enemy but sometimes (seeded) pick a slightly further one
  const enemies = (state.ships || []).filter((sh) => sh && sh.team !== ship.team);
  if (!enemies.length) return null;
  // seeded jitter to occasionally pick a different enemy
  const idx = Math.floor(srandom() * enemies.length);
  return enemies[idx];
}

function steerTowards(s: any, tx: number, ty: number, accel: number, dt: number) {
  const dx = tx - (s.x || 0); const dy = ty - (s.y || 0);
  const d = Math.hypot(dx, dy) || 1;
  const nx = dx / d; const ny = dy / d;
  s.vx = (s.vx || 0) + nx * accel * dt;
  s.vy = (s.vy || 0) + ny * accel * dt;
}

function steerAway(s: any, tx: number, ty: number, accel: number, dt: number) {
  const dx = (s.x || 0) - tx; const dy = (s.y || 0) - ty;
  const d = Math.hypot(dx, dy) || 1;
  const nx = dx / d; const ny = dy / d;
  s.vx = (s.vx || 0) + nx * accel * dt;
  s.vy = (s.vy || 0) + ny * accel * dt;
}

export function applySimpleAI(state: State, dt: number, _bounds: { W: number; H: number } = { W: 800, H: 600 }) {
  if (!state || !Array.isArray(state.ships)) return;
  for (const s of state.ships) {
    // ensure per-ship ai state
    const ai = ensureShipAiState(s);
    // decrease decision timer
    ai.decisionTimer = Math.max(0, (ai.decisionTimer || 0) - dt);

    // get target (if any) — prefer targetId if still valid
    let target = null;
    if (ai.targetId != null) target = (state.ships || []).find(sh => sh && sh.id === ai.targetId);
    if (!target) target = chooseNewTarget(state, s);
    if (target) ai.targetId = target.id;

    const accel = typeof s.accel === 'number' ? s.accel : 100;
    const maxSpeed = 160;

    // simple finite state machine
    if (!target) {
      // idle wander
      s.vx = (s.vx || 0) + (srange(-1, 1) * 8) * dt;
      s.vy = (s.vy || 0) + (srange(-1, 1) * 8) * dt;
      ai.state = 'idle';
    } else {
      // decide whether to engage or evade based on hp/shield and seeded randomness
      if (ai.decisionTimer <= 0) {
        // decision influenced by health and a small random factor
        const hpFrac = ((s.hp || 0) / Math.max(1, (s.maxHp || 1)));
        const rnd = srandom();
        if (hpFrac < 0.35 || rnd < 0.15) ai.state = 'evade';
        else if (rnd < 0.85) ai.state = 'engage'; else ai.state = 'idle';
        // set next decision 0.5-2.0s later (seeded)
        ai.decisionTimer = 0.5 + srandom() * 1.5;
      }

      // behavior per state
      if (ai.state === 'engage') {
        // steer towards target with slight aim jitter
        const aim = aimWithSpread(s, target, 0.05);
        s.vx = (s.vx || 0) + aim.x * accel * dt;
        s.vy = (s.vy || 0) + aim.y * accel * dt;
        tryFire(state, s, target, dt);
      } else if (ai.state === 'evade') {
        // steer away and sometimes strafe
        steerAway(s, target.x || 0, target.y || 0, accel * 0.8, dt);
        // small lateral jitter to avoid predictable straight-line fleeing
        const ang = Math.atan2((s.vy || 0), (s.vx || 0));
        const perp = ang + (Math.PI / 2) * (srandom() < 0.5 ? 1 : -1);
        s.vx += Math.cos(perp) * accel * 0.2 * dt; s.vy += Math.sin(perp) * accel * 0.2 * dt;
      } else {
        // idle or fallback: small random nudges
        s.vx = (s.vx || 0) + (srange(-0.5, 0.5) * 6) * dt;
        s.vy = (s.vy || 0) + (srange(-0.5, 0.5) * 6) * dt;
      }
    }
    clampSpeed(s, maxSpeed);
  }
}

// Debug helper for tests/UI: read a ship's internal AI state (copy)
export function getShipAiState(ship: any) {
  if (!ship || !ship.__ai) return null;
  const { targetId, ...rest } = ship.__ai;
  return Object.assign({}, rest);
}

// also export as named exports for consistent module interop
export default { applySimpleAI, getShipAiState };
