import { describe, it, expect } from 'vitest';
import { Ship, Bullet, Team, getClassConfig, createShipWithConfig } from '../src/entities.js';
import { srand } from '../src/rng.js';

describe('Additional coverage tests', () => {
  it('damage() returns explosion and marks ship exploded when hp falls to zero or below', () => {
    srand(1);
  const sCfg = getClassConfig('corvette');
  const s = createShipWithConfig(Team.RED, 100, 100, 'corvette', sCfg);
  // ensure shields won't absorb the test damage
  s.shield = 0;
  s.hp = 1;
    const exp = s.damage(1);
    expect(exp).toBeTruthy();
    expect(exp.x).toBeCloseTo(s.x);
    expect(exp.y).toBeCloseTo(s.y);
    expect(s.alive).toBe(false);
    expect(s._exploded).toBe(true);
  });

  it('gainXp ignores non-positive amounts', () => {
  const sCfg2 = getClassConfig('corvette');
  const s = createShipWithConfig(Team.BLUE, 200, 200, 'corvette', sCfg2);
    const before = s.xp;
    s.gainXp(0);
    expect(s.xp).toBe(before);
    s.gainXp(-5);
    expect(s.xp).toBe(before);
  });

  it('Bullet.alive respects life even when bounds not provided', () => {
    const b = new Bullet(0, 0, 0, 0, Team.RED);
    b.life = 0;
    expect(b.alive()).toBe(false);
    b.life = 0.5;
    expect(b.alive()).toBe(true);
  });

  it('xpToNext produces increasing thresholds as level grows', () => {
  const sCfg3 = getClassConfig('corvette');
  const s = createShipWithConfig(Team.RED, 0, 0, 'corvette', sCfg3);
    const v1 = s.xpToNext();
    s.level = 2;
    const v2 = s.xpToNext();
    s.level = 5;
    const v5 = s.xpToNext();
    expect(v2).toBeGreaterThanOrEqual(v1);
    expect(v5).toBeGreaterThanOrEqual(v2);
  });
});
