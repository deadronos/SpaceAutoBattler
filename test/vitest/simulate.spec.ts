import { describe, it, expect } from 'vitest';
import { srand } from '../../src/rng';
import { simulateStep } from '../../src/simulate';

function makeShip(id:number, team:'red'|'blue', x=100, y=100) {
  return { id, team, x, y, vx:0, vy:0, hp: 10, maxHp: 10, shield: 0, maxShield: 0, alive: true, type: 'fighter' } as any;
}

describe('simulate.ts', () => {
  it('advances positions deterministically with seeded RNG (no randomness used in this test)', () => {
    srand(1);
    const state = {
      ships: [makeShip(1,'red'), makeShip(2,'blue', 200, 200)],
      bullets: [],
      explosions: [],
      shieldHits: [],
      healthHits: [],
    } as any;
    const before = state.ships.map((s:any) => ({ x: s.x, y: s.y }));
    simulateStep(state, 0.016, { W: 800, H: 600 });
    const after = state.ships.map((s:any) => ({ x: s.x, y: s.y }));
    // With zero velocities, basic step should not move ships
    expect(after).toEqual(before);
  });

  it('emits well-formed arrays for events', () => {
    srand(1);
    const state = { ships: [], bullets: [], explosions: [], shieldHits: [], healthHits: [] } as any;
    simulateStep(state, 0.016, { W: 800, H: 600 });
    expect(Array.isArray(state.explosions)).toBe(true);
    expect(Array.isArray(state.shieldHits)).toBe(true);
    expect(Array.isArray(state.healthHits)).toBe(true);
  });
});
