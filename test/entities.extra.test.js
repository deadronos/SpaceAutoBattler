import { test, expect } from 'vitest';
import { srand } from '../src/rng.js';
import { createShip, createBullet, spawnFleet, Team } from '../src/entities.js';

test('createShip damage and death flow', () => {
  const s = createShip({ hp: 20, shield: 5, armor: 1 });
  const res1 = s.damage(3, null);
  // armor 1 reduces flat, so afterArmor = 2 -> shield absorbs 2
  expect(res1.shield).toBeGreaterThanOrEqual(0);
  // deal enough to kill
  const res2 = s.damage(50, null);
  expect(res2.hp).toBeGreaterThanOrEqual(0);
  expect(s.alive).toBe(false);
});

test('createBullet movement and bounds/alive', () => {
  const b = createBullet({ x: 10, y: 10, vx: 10, vy: 0, ttl: 0.1 });
  b.update(0.05);
  expect(b.ttl).toBeLessThan(0.1);
  // still alive in bounds
  expect(b.alive({ W: 100, H: 100 })).toBe(true);
  b.update(1);
  expect(b.alive({ W: 100, H: 100 })).toBe(false);
});

test('spawnFleet deterministic positions when seeded', () => {
  srand(99);
  const f1 = spawnFleet(Team.RED, 3, 200, 200);
  srand(99);
  const f2 = spawnFleet(Team.RED, 3, 200, 200);
  expect(f1.map(s => `${s.x.toFixed(2)},${s.y.toFixed(2)}`)).toEqual(f2.map(s => `${s.x.toFixed(2)},${s.y.toFixed(2)}`));
});
