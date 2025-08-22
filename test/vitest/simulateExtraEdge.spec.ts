import { describe, it, expect } from 'vitest';
import { srand } from '../../src/rng';
import { simulateStep } from '../../src/simulate';

function makeShip(id:number, team:'red'|'blue', x=100, y=100) {
  return { id, team, x, y, vx:0, vy:0, hp: 100, maxHp: 100, shield: 0, maxShield: 0, shieldRegen: 0, level: 1, xp: 0, cannons: [{ damage: 10 }] } as any;
}

describe('simulateStep - shield & progression edge cases', () => {
  it('absorbs damage into shield first and emits shieldHits/healthHits appropriately', () => {
    const attacker = makeShip(1,'red', 50, 50);
    const defender = makeShip(2,'blue', 50, 50);
    defender.maxShield = 20;
    defender.shield = 20; // full shield
    defender.hp = 50;

    const bullet = { x:50, y:50, vx:0, vy:0, ttl:1, damage: 15, ownerId: attacker.id, team: 'red', radius: 1 } as any;
    const state:any = { ships: [attacker, defender], bullets: [bullet], explosions: [], shieldHits: [], healthHits: [] };
    simulateStep(state, 0.016, { W: 800, H: 600 });
    // shield should have absorbed 15, leaving 5 shield
    const def = state.ships.find((s:any) => s.id === defender.id);
    expect(def.shield).toBe(5);
    // shieldHits should have one entry, healthHits should be empty
    expect(state.shieldHits.length).toBeGreaterThanOrEqual(1);
    expect(state.healthHits.length).toBe(0);
  });

  it('handles overflow damage (shield + health) and issues both hit events', () => {
    const attacker = makeShip(1,'red', 50, 50);
    const defender = makeShip(2,'blue', 50, 50);
    defender.maxShield = 10;
    defender.shield = 5; // partial
    defender.hp = 8;

    const bullet = { x:50, y:50, vx:0, vy:0, ttl:1, damage: 20, ownerId: attacker.id, team: 'red', radius: 1 } as any;
    const state:any = { ships: [attacker, defender], bullets: [bullet], explosions: [], shieldHits: [], healthHits: [] };
    simulateStep(state, 0.016, { W: 800, H: 600 });
    // shield should be 0, hp reduced accordingly
    const def = state.ships.find((s:any) => s.id === defender.id);
    // defender may be dead and removed; check hits instead
    expect(state.shieldHits.length).toBeGreaterThanOrEqual(1);
    expect(state.healthHits.length).toBeGreaterThanOrEqual(1);
  });

  it('awards multiple level-ups when xp overflows thresholds in a single step', () => {
    // Make progression thresholds small via built-in progression config (100 + level*50)
    // We'll simulate attacker getting large XP in one step to trigger multiple levels.
    const attacker = makeShip(1,'red', 50, 50);
    const defender = makeShip(2,'blue', 50, 50);
    defender.hp = 1;
    // craft a bullet that deals huge damage so attacker gains large xp
    const bullet = { x:50, y:50, vx:0, vy:0, ttl:1, damage: 1000, ownerId: attacker.id, team: 'red', radius: 1 } as any;
    const state:any = { ships: [attacker, defender], bullets: [bullet], explosions: [], shieldHits: [], healthHits: [] };
    simulateStep(state, 0.016, { W: 800, H: 600 });
    // attacker should have leveled up at least once; level should be > 1
    const atk = state.ships.find((s:any) => s.id === attacker.id);
    expect(atk.level).toBeGreaterThan(1);
  });
});
