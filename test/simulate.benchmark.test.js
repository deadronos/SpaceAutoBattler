import { test, expect } from 'vitest';
import { simulateStep } from '../src/simulate.js';
import { Ship, Bullet, Team } from '../src/entities.js';
import { srand, srange } from '../src/rng.js';
import { performance } from 'perf_hooks';

// Deterministic microbenchmark: 100 ships, 1000 bullets, 100 steps
test('microbenchmark: 100 ships / 1000 bullets for 100 steps completes deterministically', () => {
  srand(4242);
  Ship._id = 1;

  const ships = [];
  for (let i = 0; i < 100; i++) {
    const x = 50 + (i % 10) * 60;
    const y = 50 + Math.floor(i / 10) * 60;
    ships.push(new Ship(i % 2 === 0 ? Team.RED : Team.BLUE, x, y));
  }

  const bullets = [];
  for (let i = 0; i < 1000; i++) {
    const sx = srange(0, 800);
    const sy = srange(0, 600);
    const vx = srange(-300, 300);
    const vy = srange(-300, 300);
    const team = i % 2 === 0 ? Team.RED : Team.BLUE;
    const ownerId = ships[i % ships.length].id;
    const b = new Bullet(sx, sy, vx, vy, team, ownerId);
    bullets.push(b);
  }

  const state = { ships, bullets, explosions: [], shieldHits: [], healthHits: [], score: { red: 0, blue: 0 } };

  const steps = 100;
  const t0 = performance.now();
  for (let i = 0; i < steps; i++) simulateStep(state, 0.016, { W: 800, H: 600 });
  const t1 = performance.now();
  const ms = t1 - t0;
  // Report time for human inspection
  // Use a generous upper bound so CI can adjust; fail if extremely slow
  console.log(`microbenchmark duration: ${ms.toFixed(1)}ms`);
  expect(ms).toBeLessThan(10000); // 10 second threshold
});
