import { describe, it, expect } from 'vitest';
import { srand } from '../../src/rng';
import { simulateStep } from '../../src/simulate';

function makeShip(id:number, team:'red'|'blue', x=100, y=100, vx=0, vy=0) {
  return { id, team, x, y, vx, vy, hp: 10, maxHp: 10, shield: 0, maxShield: 0, alive: true, type: 'fighter' } as any;
}

describe('simulate wrapping', () => {
  it('wraps ship from x > bounds.W to small x when moving right', () => {
    // deterministic (no randomness expected here, but keep seed for consistency)
    srand(42);
    const bounds = { W: 800, H: 600 };
    // place ship at x = 790 (near the right edge in logical pixels)
    // give it a velocity that will move it beyond bounds.W in one step
    const stepSec = 0.1; // 100ms step
    const ship = makeShip(1, 'red', 790, 200, 200, 0); // vx = 200 px/s -> moves 20px
    const state = { ships: [ship], bullets: [], explosions: [], shieldHits: [], healthHits: [] } as any;

    // After simulateStep the ship's x should be 790 + 200*0.1 = 810 -> wrap to 10
    simulateStep(state, stepSec, bounds);
    expect(state.ships.length).toBe(1);
    const s = state.ships[0];
    // wrapped x expected small positive number (approximately 10)
    expect(s.x).toBeGreaterThanOrEqual(0);
    expect(s.x).toBeLessThan(bounds.W);
    // Because of floating rounding we check the wrapped result is near 10
    expect(Math.abs(s.x - 10)).toBeLessThan(1e-6);
  });

  it('wraps ship from x < 0 to near bounds.W when moving left', () => {
    srand(123);
    const bounds = { W: 800, H: 600 };
    const stepSec = 0.2;
    // place ship near left edge and move left fast enough to cross negative
    const ship = makeShip(2, 'blue', 5, 100, -100, 0); // moves -20 -> 5 - 20 = -15 -> wrap to 785
    const state = { ships: [ship], bullets: [], explosions: [], shieldHits: [], healthHits: [] } as any;
    simulateStep(state, stepSec, bounds);
    expect(state.ships.length).toBe(1);
    const s = state.ships[0];
    expect(s.x).toBeGreaterThanOrEqual(0);
    expect(s.x).toBeLessThan(bounds.W);
    // expected roughly 785
    expect(Math.abs(s.x - 785)).toBeLessThan(1e-6);
  });

  it('wraps ship on y-axis when moving down past bounds.H', () => {
    srand(7);
    const bounds = { W: 800, H: 600 };
    const stepSec = 0.25;
    // start near bottom and move down to cross H
    const ship = makeShip(3, 'red', 200, 590, 0, 60); // moves 15 -> 590 + 15 = 605 -> wrap to 5
    const state = { ships: [ship], bullets: [], explosions: [], shieldHits: [], healthHits: [] } as any;
    simulateStep(state, stepSec, bounds);
    expect(state.ships.length).toBe(1);
    const s = state.ships[0];
    expect(s.y).toBeGreaterThanOrEqual(0);
    expect(s.y).toBeLessThan(bounds.H);
    expect(Math.abs(s.y - 5)).toBeLessThan(1e-6);
  });

  it('handles multi-wrap when displacement exceeds bounds (x)', () => {
    srand(99);
    const bounds = { W: 800, H: 600 };
    const stepSec = 0.5;
    // set vx such that displacement > bounds.W (e.g., 2000 px over step)
    const vx = 5000; // with 0.5s step -> delta = 2500 -> 2500 % 800 = 100
    const ship = makeShip(4, 'blue', 50, 50, vx, 0);
    const state = { ships: [ship], bullets: [], explosions: [], shieldHits: [], healthHits: [] } as any;
    simulateStep(state, stepSec, bounds);
    expect(state.ships.length).toBe(1);
    const s = state.ships[0];
    // expected final x = (50 + 2500) mod 800 = 2550 mod 800 = 2550 - 3*800 = 150
    expect(Math.abs(s.x - 150)).toBeLessThan(1e-6);
  });
});

export {};
