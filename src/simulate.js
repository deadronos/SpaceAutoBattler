import { Bullet } from './entities.js';

export function simulateStep(state, dt, bounds = { W: 800, H: 600 }) {
  // state: { ships: [], bullets: [], score: {red, blue}, particles: [] }
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
        s.damage(b.dmg);
        state.bullets.splice(i, 1);
        if (!s.alive) {
          if (b.team === 0) state.score.red++;
          else state.score.blue++;
        }
        break;
      }
    }
  }
}
