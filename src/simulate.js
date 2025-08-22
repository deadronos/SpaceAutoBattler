// simulate.js - deterministic fixed-step simulation logic
import { srange, srand } from './rng.js';

// Configurable sim constants (exported for tests)
export const SIM_DT_MS = 16; // default fixed-step in ms
export const MAX_ACC_MS = 250; // clamp accumulator

// simple distance helper
function dist2(a, b) { const dx = a.x - b.x; const dy = a.y - b.y; return dx*dx + dy*dy; }

export function simulateStep(state, dtSeconds, bounds) {
  // Advance time
  state.t += dtSeconds;

  // Move bullets
  for (let i = state.bullets.length - 1; i >= 0; i--) {
    const b = state.bullets[i];
    b.x += b.vx * dtSeconds;
    b.y += b.vy * dtSeconds;
    b.ttl -= dtSeconds;
    if (b.ttl <= 0) state.bullets.splice(i, 1);
  }

  // Move ships (very small integration)
  for (const s of state.ships) {
    s.x += (s.vx || 0) * dtSeconds;
    s.y += (s.vy || 0) * dtSeconds;
    // wrap-around toroidal field
    if (s.x < 0) s.x += bounds.W; if (s.x > bounds.W) s.x -= bounds.W;
    if (s.y < 0) s.y += bounds.H; if (s.y > bounds.H) s.y -= bounds.H;
  }

  // Bullet collisions (brute force): bullet -> ship
  for (let bi = state.bullets.length - 1; bi >= 0; bi--) {
    const b = state.bullets[bi];
    for (let si = state.ships.length - 1; si >= 0; si--) {
      const s = state.ships[si];
      if (s.team === b.team) continue; // friendly fire off
      const r = (s.radius || 6) + (b.radius || 1);
      if (dist2(b, s) <= r * r) {
        // apply to shield first
        const shield = s.shield || 0;
        if (shield > 0) {
          const absorbed = Math.min(shield, b.damage);
          s.shield -= absorbed;
          state.shieldHits.push({ id: s.id, hitX: b.x, hitY: b.y, team: s.team, amount: absorbed });
          // reduce remaining damage
          const remaining = b.damage - absorbed;
          if (remaining > 0) {
            s.hp -= remaining;
            state.healthHits.push({ id: s.id, hitX: b.x, hitY: b.y, team: s.team, amount: remaining });
          }
        } else {
          s.hp -= b.damage;
          state.healthHits.push({ id: s.id, hitX: b.x, hitY: b.y, team: s.team, amount: b.damage });
        }
        // damage credit to owner
        // remove bullet
        state.bullets.splice(bi, 1);
        if (s.hp <= 0) {
          state.explosions.push({ x: s.x, y: s.y, team: s.team });
          // remove ship
          state.ships.splice(si, 1);
        }
        break;
      }
    }
  }

  // simple per-step shield regen
  for (const s of state.ships) {
    if (s.maxShield) s.shield = Math.min(s.maxShield, (s.shield || 0) + (s.shieldRegen || 0) * dtSeconds);
  }

  return state;
}

export default { simulateStep, SIM_DT_MS };
