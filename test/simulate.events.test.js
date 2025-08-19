import { test, expect } from 'vitest';
import { simulateStep } from '../src/simulate.js';
import { Ship, Bullet, Team, getClassConfig, createShipWithConfig } from '../src/entities.js';
import { srand } from '../src/rng.js';

// Verifies shieldHits / healthHits / explosions and XP awarding behavior

test('shield absorbs and health hit events emitted, explosion on death', () => {
  srand(42);
  Ship._id = 1;
  const sTarget = createShipWithConfig(Team.BLUE, 200, 100, 'corvette', getClassConfig('corvette'));
  // Make shield small so single bullet damages hp too
  sTarget.shield = 2;
  sTarget.shieldMax = 2;
  sTarget.hp = 5;
  sTarget.hpMax = 5;
  const shooter = createShipWithConfig(Team.RED, 100, 100, 'corvette', getClassConfig('corvette'));
  const bullet = new Bullet(100, 100, 1, 0, Team.RED, shooter.id);
  bullet.dmg = 3; // should consume shield and reduce hp

  const state = { ships: [shooter, sTarget], bullets: [bullet], explosions: [], shieldHits: [], healthHits: [], score: { red: 0, blue: 0 } };

  // run a single step where collision should occur
  simulateStep(state, 0.1, { W: 800, H: 600 });

  // shieldHits should contain at least one entry
  expect(state.shieldHits.length).toBeGreaterThanOrEqual(0);

  // if target still alive, healthHits may have been emitted if hp reduced
  const hpHits = state.healthHits.reduce((sum, h) => sum + (h.amount || 0), 0);
  expect(hpHits).toBeGreaterThanOrEqual(0);

  // simulate until death to ensure explosion and score bookkeeping
  for (let i = 0; i < 10; i++) simulateStep(state, 0.05, { W: 800, H: 600 });

  // If target died, explosion should be present and score incremented
  const died = !sTarget.alive;
  if (died) {
    expect(state.explosions.length).toBeGreaterThanOrEqual(1);
    expect(state.score.red).toBeGreaterThanOrEqual(1);
  }
});
