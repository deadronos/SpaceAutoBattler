import { test, expect } from 'vitest';
import { srand } from '../src/rng.js';
import { Ship } from '../src/entities.js';

test('ship accelerates from zero velocity on update', () => {
  // deterministic seed
  srand(42);
  const s = new Ship(0, 100, 100, 'corvette');
  // start at rest
  expect(s.vx).toBe(0);
  expect(s.vy).toBe(0);
  // call update with a small dt and no other ships -> should apply small forward thrust
  s.angle = 0; // face right
  s.update(0.016, []);
  const speed = Math.hypot(s.vx, s.vy);
  expect(speed).toBeGreaterThan(0);
});
