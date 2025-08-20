import { describe, it, expect } from 'vitest';
import { srand } from '../src/rng.js';
import { createShip, createBullet, Team, spawnFleet } from '../src/entities.js';

describe('entities - shields & progression', () => {
  it('initializes shieldMax as ~60% of hpMax and shield starts full', () => {
    srand(1);
    const s = createShip({ team: Team.RED, x: 0, y: 0, maxHp: 100 });
    expect(s.maxShield).toBe(Math.round(s.maxHp * 0.6));
    expect(s.shield).toBe(s.maxShield);
  });

  it('absorbs damage into shield before HP (no kill)', () => {
    const s = createShip({ team: Team.BLUE, x:0, y:0, maxHp: 50 });
    const dmg = Math.max(1, Math.floor(s.maxShield / 2));
    const b = createBullet({ x: s.x - 10, y: s.y, vx: 100, vy:0, team: Team.RED, dmg });
    const res = s.damage(dmg);
    expect(res.shield).toBeGreaterThanOrEqual(1);
    expect(res.hp).toBe(0);
    expect(s.alive).toBe(true);
  });

  it('overflow damage reduces HP after shields are depleted', () => {
    const s = createShip({ team: Team.BLUE, x:0, y:0, maxHp: 50 });
    const dmg = s.maxShield + 5;
    const res = s.damage(dmg);
    expect(res.hp).toBeGreaterThanOrEqual(1);
  });

  it('spawnFleet deterministic composition with seed', () => {
    srand(424242);
    const a = spawnFleet(Team.BLUE, 6, 400, 300);
    srand(424242);
    const b = spawnFleet(Team.BLUE, 6, 400, 300);
    expect(a.map(s => s.type)).toEqual(b.map(s => s.type));
  });
});
