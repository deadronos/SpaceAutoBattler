import { describe, it, expect } from 'vitest';
import { srand } from '../src/rng.js';
import { Ship, Bullet, Team, getClassConfig, createShipWithConfig } from '../src/entities.js';
import { simulateStep } from '../src/simulate.js';

describe('Shields', () => {
  it('initializes shieldMax as ~60% of hpMax and shield starts full', () => {
    srand(1);
  const s = createShipWithConfig(Team.RED, 100, 100, 'corvette', getClassConfig('corvette'));
    expect(s.shieldMax).toBe(Math.round(s.hpMax * 0.6));
    expect(s.shield).toBe(s.shieldMax);
    expect(s.shieldRegen).toBeGreaterThanOrEqual(0.5);
  });

  it('absorbs damage into shield before HP (no kill)', () => {
    srand(2);
  const s = createShipWithConfig(Team.BLUE, 200, 200, 'corvette', getClassConfig('corvette'));
    const dmg = Math.max(1, Math.floor(s.shieldMax / 2));
    const b = new Bullet(s.x - 10, s.y, 100, 0, Team.RED);
    b.dmg = dmg;
    const state = { ships: [s], bullets: [b], score: { red: 0, blue: 0 }, particles: [], explosions: [] };
    simulateStep(state, 0.05, { W: 800, H: 600 });
    expect(s.alive).toBe(true);
    expect(state.score.red).toBe(0);
    expect(s.shield).toBe(s.shieldMax - dmg);
    expect(s.hp).toBe(s.hpMax);
  });

  it('overflow damage reduces HP after shields are depleted', () => {
    srand(3);
  const s = createShipWithConfig(Team.BLUE, 150, 150, 'corvette', getClassConfig('corvette'));
    const dmg = s.shieldMax + 5;
    const b = new Bullet(s.x - 10, s.y, 100, 0, Team.RED);
    b.dmg = dmg;
    const state = { ships: [s], bullets: [b], score: { red: 0, blue: 0 }, particles: [], explosions: [] };
    simulateStep(state, 0.05, { W: 800, H: 600 });
    expect(s.alive).toBe(true);
    expect(s.shield).toBe(0);
    expect(s.hp).toBe(s.hpMax - 5);
  });

  it('regenerates shield over time via update()', () => {
    srand(4);
  const s = createShipWithConfig(Team.RED, 100, 100, 'corvette', getClassConfig('corvette'));
    s.shield = 0;
    const regen = s.shieldRegen;
    s.update(1, [s]);
    expect(s.shield).toBeCloseTo(Math.min(s.shieldMax, regen * 1));
  });
});
