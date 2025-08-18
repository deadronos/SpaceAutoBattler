import { describe, it, expect } from 'vitest';
import { srand } from '../src/rng.js';
import { Ship, Team } from '../src/entities.js';
import { DMG_PERCENT_PER_LEVEL } from '../src/progressionConfig.js';

describe('Bullet damage scaling by ship level', () => {
  it('bullets fired after level-up have increased average damage', () => {
    srand(12345);
    // Ship at level 1
    const s1 = new Ship(Team.RED, 100, 100, 'corvette');
    const dummy1 = new Ship(Team.BLUE, 120, 100, 'corvette');
    const ships1 = [s1, dummy1];
    let dmgSum1 = 0;
    let n1 = 10;
    for (let i = 0; i < n1; i++) {
      s1.cooldown = 0;
      let bullets = [];
      let tries = 0;
      while (bullets.length === 0 && tries < 10) {
        s1.update(0.1, ships1, bullets);
        tries++;
      }
      expect(bullets.length).toBeGreaterThan(0);
      dmgSum1 += bullets[0].dmg;
    }
    const avgDmg1 = dmgSum1 / n1;

    // Ship at higher level
    srand(12345);
    const s2 = new Ship(Team.RED, 100, 100, 'corvette');
    const dummy2 = new Ship(Team.BLUE, 120, 100, 'corvette');
    const ships2 = [s2, dummy2];
    s2.gainXp(1000); // should level up several times
    let dmgSum2 = 0;
    let n2 = 10;
    for (let i = 0; i < n2; i++) {
      s2.cooldown = 0;
      let bullets2 = [];
      let tries = 0;
      while (bullets2.length === 0 && tries < 10) {
        s2.update(0.1, ships2, bullets2);
        tries++;
      }
      expect(bullets2.length).toBeGreaterThan(0);
      dmgSum2 += bullets2[0].dmg;
    }
    const avgDmg2 = dmgSum2 / n2;
    expect(s2.level).toBeGreaterThan(1);
    expect(avgDmg2).toBeGreaterThan(avgDmg1);
    // Scaling should be correct
    const expectedScale = 1 + (s2.level - 1) * DMG_PERCENT_PER_LEVEL;
    expect(Math.abs(avgDmg2 / avgDmg1 - expectedScale)).toBeLessThan(0.01);
  });
});
