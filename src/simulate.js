import { createBullet } from './entities.js';
import { srange } from './rng.js';

// Simple AABB collision by radius
function collides(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const r = (a.radius || 0) + (b.radius || 0);
  return dx * dx + dy * dy <= r * r;
}

export function simulateStep(state, dt, bounds) {
  if (!dt || dt <= 0) return;
  state.explosions = state.explosions || [];
  state.shieldHits = state.shieldHits || [];
  state.healthHits = state.healthHits || [];

  // Update ships
  for (let i = 0; i < state.ships.length; i++) {
    const s = state.ships[i];
    if (s.update) s.update(dt, state);
    // wrap on toroidal field
    if (bounds) {
      if (s.x < 0) s.x += bounds.W;
      else if (s.x > bounds.W) s.x -= bounds.W;
      if (s.y < 0) s.y += bounds.H;
      else if (s.y > bounds.H) s.y -= bounds.H;
    }
    // simple firing: probabilistic small chance to shoot
    if (s.cannons && s.cannons.length && Math.random() < 0.01) {
      const c = s.cannons[0];
      const angle = srange(0, Math.PI * 2);
      const speed = 200;
      const vx = Math.cos(angle) * speed;
      const vy = Math.sin(angle) * speed;
      const b = createBullet({ x: s.x, y: s.y, vx, vy, team: s.team, dmg: c.damage || s.dmg, ownerId: s.id });
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
        const hit = ship.damage(bullet.dmg, bullet);
        if (hit.shield) state.shieldHits.push({ id: ship.id, hitX: bullet.x, hitY: bullet.y, team: ship.team, amount: hit.shield });
        if (hit.hp) state.healthHits.push({ id: ship.id, hitX: bullet.x, hitY: bullet.y, team: ship.team, amount: hit.hp });
        // award xp to owner if known
        if (bullet.ownerId != null) {
          const owner = state.ships.find(s => s.id === bullet.ownerId);
          if (owner && owner.gainXp) owner.gainXp(hit.shield + hit.hp);
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
