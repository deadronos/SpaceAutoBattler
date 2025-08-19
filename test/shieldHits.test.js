import { describe, it, expect, beforeEach } from 'vitest';
import { srand } from '../src/rng.js';
import { Ship, Bullet, Team, getClassConfig, createShipWithConfig } from '../src/entities.js';
import { simulateStep } from '../src/simulate.js';

describe('simulateStep shieldHits events', () => {
  beforeEach(() => { srand(99); });

  it('emits shieldHits when shield is reduced by a hit', () => {
  const attacker = createShipWithConfig(Team.RED, 100, 100, 'corvette', getClassConfig('corvette'));
  const target = createShipWithConfig(Team.BLUE, 110, 100, 'corvette', getClassConfig('corvette'));
    // ensure target has shields
    expect(target.shield).toBeGreaterThan(0);
    const b = new Bullet(attacker.x, attacker.y, 10, 0, attacker.team, attacker.id);
    b.dmg = Math.max(1, Math.round(target.shield / 2));
    const shieldHits = [];
  const state = { ships: [attacker, target], bullets: [b], score: { red:0, blue:0 }, particles: [], explosions: [], shieldHits };
  // use dt=0 to avoid shield regeneration during the update phase which would
  // otherwise refill a drained shield before collision handling
  simulateStep(state, 0, { W: 800, H: 600 });
    expect(Array.isArray(state.shieldHits)).toBe(true);
    expect(state.shieldHits.length).toBeGreaterThan(0);
    const h = state.shieldHits[0];
    expect(h.id).toBe(target.id);
    expect(h.amount).toBeGreaterThan(0);
  });

  it('does not emit shieldHits when damage goes straight to HP (no shield)', () => {
  const attacker = createShipWithConfig(Team.RED, 200, 200, 'destroyer', getClassConfig('destroyer'));
  const target = createShipWithConfig(Team.BLUE, 205, 200, 'fighter', getClassConfig('fighter'));
    // drain target shield
    target.shield = 0;
    const b = new Bullet(attacker.x, attacker.y, 10, 0, attacker.team, attacker.id);
    b.dmg = 5;
    const shieldHits = [];
  const state = { ships: [attacker, target], bullets: [b], score: { red:0, blue:0 }, particles: [], explosions: [], shieldHits };
  // run with dt=0 to prevent regen before collision processing
  simulateStep(state, 0, { W: 800, H: 600 });
    expect(state.shieldHits.length).toBe(0);
  });
});
