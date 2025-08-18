import { test, expect } from 'vitest';
import { simulateStep } from '../src/simulate.js';
import { Ship, Bullet, Team } from '../src/entities.js';
import { srand } from '../src/rng.js';

function makeState() {
  const s1 = new Ship(Team.RED, 100, 100);
  const s2 = new Ship(Team.BLUE, 200, 100);
  // bullet fired from s1 toward s2
  const dx = s2.x - s1.x; const dy = s2.y - s1.y; const dist = Math.hypot(dx, dy) || 1;
  const bdx = dx / dist; const bdy = dy / dist; const spd = 300;
  const bullet = new Bullet(s1.x + bdx * 12, s1.y + bdy * 12, bdx * spd, bdy * spd, Team.RED, s1.id);
  bullet.dmg = 8;
  return { ships: [s1, s2], bullets: [bullet], explosions: [], shieldHits: [], healthHits: [], score: { red: 0, blue: 0 } };
}

test('simulateStep deterministic with same seed', () => {
  // create and run first simulation
  srand(12345);
  Ship._id = 1;
  const sA = makeState();
  for (let i = 0; i < 20; i++) simulateStep(sA, 0.05, { W: 800, H: 600 });
  const outA = JSON.stringify(sA);

  // recreate identical initial conditions and run again
  srand(12345);
  Ship._id = 1;
  const sB = makeState();
  for (let i = 0; i < 20; i++) simulateStep(sB, 0.05, { W: 800, H: 600 });
  const outB = JSON.stringify(sB);

  expect(outA).toBe(outB);
});
