import { describe, it, expect } from 'vitest';
import { srand } from '../../src/rng';
import { applySimpleAI } from '../../src/behavior';

function ship(id:number, team:'red'|'blue', x:number, y:number) {
  return {
    id, team, x, y,
    vx: 0, vy: 0,
    hp: 10, maxHp: 10,
    shield: 0, maxShield: 0,
    accel: 200,
    cannons: [{ damage: 3, rate: 5, muzzleSpeed: 200, bulletTTL: 1.5, bulletRadius: 1.2, spread: 0.02 }]
  } as any;
}

describe('behavior.ts applySimpleAI', () => {
  it('steers ships and fires bullets deterministically', () => {
    srand(42);
    const state:any = { ships: [ship(1,'red', 100, 100), ship(2,'blue', 300, 100)], bullets: [] };
    // run AI for a few frames at 60 FPS
    for (let i=0;i<30;i++) applySimpleAI(state, 1/60, { W: 800, H: 600 });
    // Should have produced at least one bullet and adjusted velocities
    expect(state.bullets.length).toBeGreaterThan(0);
    // Red ship should be moving roughly towards +x
    expect(state.ships[0].vx).toBeGreaterThan(0);
  });
});
