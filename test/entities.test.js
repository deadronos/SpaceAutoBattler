import { describe, it, expect } from 'vitest';
import { srand } from '../src/rng.js';
import { Ship, Bullet, Team, spawnFleet } from '../src/entities.js';
import { simulateStep } from '../src/simulate.js';
import * as gm from '../src/gamemanager.js';

describe('Entities', () => {
  it('Ship.pickTarget finds nearest visible enemy', () => {
    srand(1);
    const s1 = new Ship(Team.RED, 100, 100);
    const s2 = new Ship(Team.BLUE, 150, 100); // 50 away
    const s3 = new Ship(Team.BLUE, 400, 400); // far
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
    const c1 = new Ship(Team.RED, 200, 200, 'carrier');
    const la1 = c1.launchAmount; const lc1 = c1.launchCooldown;
    srand(2025);
    const c2 = new Ship(Team.RED, 200, 200, 'carrier');
    expect(c2.launchAmount).toBe(la1);
    expect(c2.launchCooldown).toBeCloseTo(lc1);
  });

  it('Carrier launches fighters when cooldown elapsed', () => {
    srand(303);
    const c = new Ship(Team.RED, 300, 300, 'carrier');
  // Use gm.ships (the manager-owned ships array) since gm.simulate operates on it
  gm.reset();
  gm.ships.length = 0; gm.ships.push(c);
  // Force immediate launch
  c.launchCooldown = 0;
  const expected = Math.max(1, Math.floor(c.launchAmount));
  // manager is responsible for carrier launch decisions
  gm.simulate(0.016, 800, 600);
  const fighters = gm.ships.filter(s => s.type === 'fighter');
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
