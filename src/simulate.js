import { srange, srangeInt } from './rng.js';
import { Ship } from './entities.js';

export function simulateStep(state, dt, bounds = { W: 800, H: 600 }) {
  // state: { ships: [], bullets: [], score: {red, blue}, particles: [] }
  // Update ships (they may push bullets into state.bullets when provided)
  for (const s of state.ships) {
    if (s.alive) s.update(dt, state.ships, state.bullets);
  }

  // Wrap ships across screen boundaries so they reappear on the opposite side
  if (bounds && typeof bounds.W === 'number' && typeof bounds.H === 'number') {
    const W = bounds.W, H = bounds.H;
    for (const s of state.ships) {
      if (!s.alive) continue;
      const r = s.radius || 0;
      if (s.x < -r) s.x += (W + r * 2);
      else if (s.x > W + r) s.x -= (W + r * 2);
      if (s.y < -r) s.y += (H + r * 2);
      else if (s.y > H + r) s.y -= (H + r * 2);
    }
  }

  // NOTE: carrier launch decisions are handled by the game manager; this
  // step function focuses on deterministic physics/collisions and emits
  // events (explosions, shieldHits, healthHits, damageEvents, killEvents)

  // Update bullets
  for (let i = state.bullets.length - 1; i >= 0; i--) {
    const b = state.bullets[i];
    b.update(dt);
    if (!b.alive(bounds)) state.bullets.splice(i, 1);
  }

  // Bullet collisions
  for (let i = state.bullets.length - 1; i >= 0; i--) {
    const b = state.bullets[i];
    for (const s of state.ships) {
      if (!s.alive || s.team === b.team) continue;
      const dx = s.x - b.x, dy = s.y - b.y;
      const d2 = dx * dx + dy * dy;
      const R = s.radius + b.radius;
      if (d2 < R * R) {
        // capture explosion info if any
        const dmg = b.dmg;
        // record shield and hp before damage so we can generate visuals for shield/hp hits
        const prevShield = typeof s.shield === 'number' ? s.shield : 0;
        const prevHp = typeof s.hp === 'number' ? s.hp : 0;
        const exp = s.damage(dmg);
        const shieldTaken = Math.max(0, prevShield - (typeof s.shield === 'number' ? s.shield : 0));
        const hpTaken = Math.max(0, prevHp - (typeof s.hp === 'number' ? s.hp : 0));
        if (shieldTaken > 0 && state && Array.isArray(state.shieldHits)) {
          // include the bullet impact coordinates so renderer can draw an arc at the impact direction
          state.shieldHits.push({ id: s.id, hitX: b.x, hitY: b.y, team: s.team, amount: shieldTaken });
        }
        if (hpTaken > 0 && state && Array.isArray(state.healthHits)) {
          state.healthHits.push({ id: s.id, hitX: b.x, hitY: b.y, team: s.team, amount: hpTaken });
        }
        // Emit damage event for manager to process (XP awarding etc.)
        if (!Array.isArray(state.damageEvents)) state.damageEvents = [];
        if (b.ownerId != null) state.damageEvents.push({ ownerId: b.ownerId, dmg });

        state.bullets.splice(i, 1);
        if (exp && state.explosions) state.explosions.push(exp);
        if (!s.alive) {
          // Emit kill event for manager (include killer team for scoring)
          if (!Array.isArray(state.killEvents)) state.killEvents = [];
          state.killEvents.push({ id: s.id, type: s.type, ownerCarrier: s.ownerCarrier, level: s.level, team: s.team, killerId: b.ownerId, killerTeam: b.team, x: s.x, y: s.y });
        }
        break;
      }
    }
  }

  // Cleanup decisions are left to the game manager (carrier active lists, scoring, XP)
}
