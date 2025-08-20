import { describe, it, expect } from 'vitest';
import { createShip, createBullet } from '../src/entities.js';

describe('entities (minimal)', () => {
  it('createShip returns an object with expected fields', () => {
    const s = createShip({ id: 1, x: 10, y: 20, team: 'red' });
    expect(s.id).toBe(1);
    expect(s.x).toBe(10);
    expect(s.y).toBe(20);
    expect(typeof s.update).toBe('function');
  });

  it('damage reduces shield before hp and returns result object', () => {
    const s = createShip({ hp: 10, maxHp: 10, shield: 5, maxShield: 5 });
    const r = s.damage(3);
    expect(r.shield).toBe(3);
    expect(r.hp).toBe(0);
    expect(s.shield).toBe(2);
  });

  it('createBullet update and alive semantics', () => {
    const b = createBullet({ x:0, y:0, vx:10, vy:0, ttl:1 });
    b.update(0.5);
    expect(b.x).toBeCloseTo(5);
    expect(b.ttl).toBeCloseTo(0.5);
    expect(b.alive({ W: 100, H: 100 })).toBe(true);
    b.update(1);
    expect(b.alive({ W: 100, H: 100 })).toBe(false);
  });
});
