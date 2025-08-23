import { describe, it, expect } from 'vitest';
import { srand } from '../../src/rng';
import { simulateStep } from '../../src/simulate';

function makeShip(id:number, team:'red'|'blue', x=100, y=100) {
  return { id, team, x, y, vx:0, vy:0, hp: 10, maxHp: 10, shield: 0, maxShield: 0, alive: true, type: 'fighter' } as any;
}

describe('simulateStep - edge cases', () => {
  it('does not normalize coords when bounds are zero or negative', () => {
    srand(1);
    const state = { ships: [makeShip(1,'red', 950, 450)], bullets: [], explosions: [], shieldHits: [], healthHits: [] } as any;
    const beforeX = state.ships[0].x;
    simulateStep(state, 0, { W: 0, H: -100 });
    // bounds are non-positive so the normalization branch should be skipped
    expect(state.ships[0].x).toBe(beforeX);
  });

  it('correctly handles multi-wrap displacements on both axes', () => {
    const W = 800;
    const H = 600;
    // pick a ship initially at (10,20) but simulate a huge displacement by setting coords directly
    const sx = 10 + W * 3 + 160; // will normalize to (10+160)=170
    const sy = 20 + H * 5 + 45;  // will normalize to (20+45)=65
    const state = { ships: [makeShip(1,'red', sx, sy)], bullets: [], explosions: [], shieldHits: [], healthHits: [] } as any;
    simulateStep(state, 0, { W, H });
    const s = state.ships[0];
    const expectedX = ((sx % W) + W) % W;
    const expectedY = ((sy % H) + H) % H;
    expect(s.x).toBe(expectedX);
    expect(s.y).toBe(expectedY);
  });

  it('awards XP to bullet owner for damage and kills (deterministic progression)', () => {
    // attacker will fire and kill defender in one hit
    const attacker = makeShip(1,'red', 100, 100);
    const defender = makeShip(2,'blue', 100, 100);
    defender.hp = 5;
    const bullet:any = { x: 100, y: 100, vx: 0, vy: 0, ttl: 1, damage: 5, ownerId: attacker.id, team: 'red', radius: 1 };
    const state:any = { ships: [attacker, defender], bullets: [bullet], explosions: [], shieldHits: [], healthHits: [] };
    simulateStep(state, 0.016, { W: 800, H: 600 });
    // bullet should be removed and explosion should be emitted; attacker should have gained damage XP + kill XP
    expect(state.explosions.length).toBeGreaterThanOrEqual(1);
    // xpPerDamage = 1, damage = 5, xpPerKill = 50 => total 55
    const atk = state.ships.find((s:any) => s.id === attacker.id);
    // attacker should still be present and have xp added
    expect(atk).toBeDefined();
    expect(atk.xp).toBe(55);
  });
});
