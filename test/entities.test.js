import { describe, it, expect } from 'vitest';
import { srand } from '../src/rng.js';
import { Ship, Bullet, Team, spawnFleet, getClassConfig, createShipWithConfig } from '../src/entities.js';
import { simulateStep } from '../src/simulate.js';

describe('Entities', () => {
  it('Ship.pickTarget finds nearest visible enemy', () => {
    srand(1);
  const s1 = createShipWithConfig(Team.RED, 100, 100, 'corvette', getClassConfig('corvette'));
  const s2 = createShipWithConfig(Team.BLUE, 150, 100, 'corvette', getClassConfig('corvette'));
  const s3 = createShipWithConfig(Team.BLUE, 400, 400, 'corvette', getClassConfig('corvette'));
    const ships = [s1, s2, s3];
    const t = s1.pickTarget(ships);
    expect(t).toBe(s2);
  });

  it('Bullet updates position and life', () => {
    const b = new Bullet(0, 0, 10, 0, Team.RED);
    b.update(0.5);
    expect(b.x).toBeCloseTo(5);
    expect(b.life).toBeCloseTo(2.0);
  });

  it('Carrier properties are deterministic with seed', () => {
    srand(2025);
  const c1 = createShipWithConfig(Team.RED, 200, 200, 'carrier', getClassConfig('carrier'));
    const la1 = c1.launchAmount; const lc1 = c1.launchCooldown;
    srand(2025);
  const c2 = createShipWithConfig(Team.RED, 200, 200, 'carrier', getClassConfig('carrier'));
    expect(c2.launchAmount).toBe(la1);
    expect(c2.launchCooldown).toBeCloseTo(lc1);
  });

  it('Carrier launches fighters when cooldown elapsed', () => {
    srand(303);
  const c = createShipWithConfig(Team.RED, 300, 300, 'carrier', getClassConfig('carrier'));
    const state = { ships: [c], bullets: [], score: { red: 0, blue: 0 }, particles: [], explosions: [] };
    // Force immediate launch
    c.launchCooldown = 0;
    const expected = Math.max(1, Math.floor(c.launchAmount));
    simulateStep(state, 0.016, { W: 800, H: 600 });
    const fighters = state.ships.filter(s => s.type === 'fighter');
    expect(fighters.length).toBe(expected);
    for (const f of fighters) { expect(f.team).toBe(Team.RED); expect(f.alive).toBe(true); expect(Math.hypot(f.vx, f.vy)).toBeGreaterThan(10); }
  });

  it('spawnFleet deterministic composition with seed', () => {
    srand(424242);
    const a = spawnFleet(Team.BLUE, 12, 400, 300);
    const typesA = a.map(s => s.type);
    srand(424242);
    const b = spawnFleet(Team.BLUE, 12, 400, 300);
    const typesB = b.map(s => s.type);
    expect(typesA).toEqual(typesB);
  });
});
