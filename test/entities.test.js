import { describe, it, expect } from 'vitest';
import { srand } from '../src/rng.js';
import { Ship, Bullet, Team } from '../src/entities.js';

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
});
