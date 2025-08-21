import { createBullet } from './entities.js';
import { srange } from './rng.js';

// Simple AABB collision by radius
function collides(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const r = (a.radius || 0) + (b.radius || 0);
  return dx * dx + dy * dy <= r * r;
}
/**
 * Advance the simulation by dt seconds, mutating the provided `state`.
 * The function is deterministic when the global RNG is seeded via srand().
 *
 * @param {Object} state simulation state (ships, bullets, particles, stars)
 * @param {number} dt timestep in seconds
 * @param {Object} bounds optional bounds { W, H } to wrap positions
 */
export function simulateStep(state, dt, bounds) {
  if (!dt || dt <= 0) return;

  // defensive defaults for expected arrays on the state object
  state.explosions = state.explosions || [];
  state.shieldHits = state.shieldHits || [];
  state.healthHits = state.healthHits || [];
  state.stars = state.stars || [];
  state.ships = state.ships || [];
  state.bullets = state.bullets || [];

  // Update stars (twinkle progression) — deterministic via srange
  for (let i = 0; i < state.stars.length; i++) {
    const star = state.stars[i];
    star.a = srange(0.1, 1.0);
  }

  // Update ships
  for (let i = 0; i < state.ships.length; i++) {
    const s = state.ships[i];
    if (s.update) s.update(dt, state);
    // wrap on toroidal field
    if (bounds && typeof bounds.W === 'number' && typeof bounds.H === 'number') {
      if (s.x < 0) s.x += bounds.W;
      else if (s.x > bounds.W) s.x -= bounds.W;
      if (s.y < 0) s.y += bounds.H;
      else if (s.y > bounds.H) s.y -= bounds.H;
    }
    // simple firing: probabilistic small chance to shoot. Use seeded RNG (srange)
    if (s.cannons && s.cannons.length && srange(0, 1) < 0.01) {
      const c = s.cannons[0];
      const angle = srange(0, Math.PI * 2);
      const speed = 200;
      const vx = Math.cos(angle) * speed;
      const vy = Math.sin(angle) * speed;
      const b = createBullet({ x: s.x, y: s.y, vx, vy, team: s.team, dmg: (c && c.damage) || s.dmg, ownerId: s.id });
      state.bullets.push(b);
    }
  }

  // Update bullets and resolve collisions (iterate backwards)
  for (let bi = state.bullets.length - 1; bi >= 0; bi--) {
    const bullet = state.bullets[bi];
    if (bullet.update) bullet.update(dt);
    if (!bullet.alive(bounds)) { state.bullets.splice(bi, 1); continue; }
    // check collisions
    for (let si = state.ships.length - 1; si >= 0; si--) {
      const ship = state.ships[si];
      if (!ship.alive || ship.team === bullet.team) continue;
      if (collides(bullet, ship)) {
        const hit = ship.damage(bullet.dmg, bullet) || { shield: 0, hp: 0 };
        if (hit.shield) state.shieldHits.push({ id: ship.id, hitX: bullet.x, hitY: bullet.y, team: ship.team, amount: hit.shield });
        if (hit.hp) state.healthHits.push({ id: ship.id, hitX: bullet.x, hitY: bullet.y, team: ship.team, amount: hit.hp });
        // award xp to owner if known
        if (bullet.ownerId != null) {
          // prefer finding owner by index to avoid creating intermediate arrays
          for (let oi = 0; oi < state.ships.length; oi++) {
            const owner = state.ships[oi];
            if (owner && owner.id === bullet.ownerId && owner.gainXp) { owner.gainXp((hit.shield || 0) + (hit.hp || 0)); break; }
          }
        }
        state.bullets.splice(bi, 1);
        if (!ship.alive) {
          state.explosions.push({ x: ship.x, y: ship.y, team: ship.team });
          state.ships.splice(si, 1);
        }
        break;
      }
    }
  }
}

export default { simulateStep };
