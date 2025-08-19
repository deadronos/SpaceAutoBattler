import { test, expect } from 'vitest';
import { srand } from '../src/rng.js';
import { Ship } from '../src/entities.js';
import { simulateStep } from '../src/simulate.js';

test('carrier does not exceed max active fighters and cleans up on death', () => {
  srand(42);
  const W = 800, H = 600;
  // create a single carrier for team RED at center (instantiate directly)
  const carrier = new Ship(0, W/2, H/2, 'carrier');
  expect(carrier.type).toBe('carrier');
  // prepare simulation state
  const state = { ships: [carrier], bullets: [], score: { red: 0, blue: 0 }, particles: [], explosions: [], shieldHits: [], healthHits: [] };

  // run simulation for a number of seconds to allow multiple launch attempts
  for (let i = 0; i < 200; i++) {
    simulateStep(state, 0.05, { W, H });
    // find the live carrier in state (it may still be the same object)
    const c = state.ships.find(s => s.id === carrier.id);
    if (c) {
      // activeFighters should never exceed maxFighters (6)
      const active = Array.isArray(c.activeFighters) ? c.activeFighters.length : 0;
      expect(active).toBeLessThanOrEqual(c.maxFighters || 6);
    }
  }

  // Now kill the carrier explicitly and run one more step to trigger cleanup
  carrier.hp = 0; carrier.alive = false;
  // push an explosion entry similar to damage() return (id/type/ownerCarrier)
  state.explosions.push({ id: carrier.id, type: 'carrier' });
  simulateStep(state, 0.05, { W, H });

  // carrier's activeFighters should have been cleared
  const cc = state.ships.find(s => s.id === carrier.id);
  if (cc) expect(Array.isArray(cc.activeFighters) ? cc.activeFighters.length : 0).toBe(0);

  // any fighters that were owned by this carrier must no longer reference ownerCarrier
  for (const s of state.ships) {
    if (s.type === 'fighter') expect(s.ownerCarrier).toBe(null);
  }
});
