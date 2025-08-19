import { test, expect } from 'vitest';
import { srand } from '../src/rng.js';
import { Ship } from '../src/entities.js';
import { EVASIVE_DURATION } from '../src/behaviorConfig.js';

// Deterministic test: when a ship takes damage, it becomes evasive and should increase
// distance from an attacker over a short simulation window.
test('damaged ship moves away from attacker (evasive)', () => {
  srand(123);
  // attacker on left, target on right
  const attacker = new Ship(0, 100, 100, 'corvette');
  const target = new Ship(1, 130, 100, 'corvette');
  // ensure both start at rest
  attacker.vx = attacker.vy = 0;
  target.vx = target.vy = 0;
  // record initial distance
  const initialDist = Math.hypot(target.x - attacker.x, target.y - attacker.y);

  // damage the target so it becomes evasive
  target.damage(10);
  expect(target.recentHitTimer).toBeGreaterThan(0);

  // simulate for EVASIVE_DURATION seconds in small steps
  const dt = 0.05;
  const steps = Math.ceil((EVASIVE_DURATION + 0.1) / dt);
  for (let i = 0; i < steps; i++) {
    // update both ships; attacker will try to pursue target
    attacker.update(dt, [attacker, target]);
    target.update(dt, [attacker, target]);
  }

  const finalDist = Math.hypot(target.x - attacker.x, target.y - attacker.y);
  // target should have moved away from attacker while evasive
  expect(finalDist).toBeGreaterThan(initialDist - 1e-6);
});
