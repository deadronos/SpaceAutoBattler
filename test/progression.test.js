import { describe, it, expect, beforeEach } from 'vitest';
import { srand } from '../src/rng.js';
import { Ship, Bullet, Team } from '../src/entities.js';
import { simulateStep } from '../src/simulate.js';
import * as gm from '../src/gamemanager.js';

describe('Progression and XP', () => {
  beforeEach(() => { srand(42); });

  it('awards XP to the owner on damage (via emitted events)', () => {
    const attacker = new Ship(Team.RED, 100, 100, 'corvette');
    const target = new Ship(Team.BLUE, 110, 100, 'corvette');
    // ensure a bullet from attacker hits target
    const b = new Bullet(attacker.x, attacker.y, 10, 0, attacker.team, attacker.id);
    b.dmg = 10;
    const state = { ships: [attacker, target], bullets: [b], score: { red: 0, blue: 0 }, particles: [], explosions: [] };
  simulateStep(state, 0.016, { W: 800, H: 600 });
  // simulateStep should emit damageEvents; manager normally processes them
  expect(Array.isArray(state.damageEvents)).toBe(true);
  expect(state.damageEvents.length).toBeGreaterThan(0);
  // verify the event points to attacker as owner and carries a numeric damage amount
  const dmgEv = state.damageEvents.find(e => e.ownerId === attacker.id);
  expect(dmgEv).toBeDefined();
  expect(typeof dmgEv.dmg).toBe('number');
  expect(dmgEv.dmg).toBeGreaterThan(0);
  });

  it('awards kill XP to the owner on kill (via emitted events)', () => {
    const attacker = new Ship(Team.RED, 200, 200, 'destroyer');
    const target = new Ship(Team.BLUE, 205, 200, 'fighter');
    // big bullet to kill
    const b = new Bullet(attacker.x, attacker.y, 10, 0, attacker.team, attacker.id);
    b.dmg = 9999;
    const state = { ships: [attacker, target], bullets: [b], score: { red: 0, blue: 0 }, particles: [], explosions: [] };
  simulateStep(state, 0.016, { W: 800, H: 600 });
  expect(Array.isArray(state.killEvents)).toBe(true);
  expect(state.killEvents.length).toBeGreaterThan(0);
  const k = state.killEvents[0];
  // verify kill event carries expected metadata
  expect(k.killerId).toBe(attacker.id);
  expect(typeof k.id).toBe('number');
  expect(typeof k.level).toBe('number');
  expect(typeof k.type).toBe('string');
  expect(typeof k.team).toBe('number');
  expect(typeof k.x).toBe('number');
  expect(typeof k.y).toBe('number');
  // ensure target was marked dead by simulateStep
  expect(target.alive).toBe(false);
  });

  it('levels up when xp threshold reached and scales hp and shield', () => {
    const s = new Ship(Team.RED, 300, 300, 'frigate');
    const baseHp = s.baseHpMax;
    const baseShield = s.shieldMax;
    // artificially grant xp enough for several levels
    s.gainXp(1000);
    expect(s.level).toBeGreaterThan(1);
    expect(s.hpMax).toBeGreaterThanOrEqual(baseHp);
    expect(s.shieldMax).toBeGreaterThanOrEqual(baseShield);
  });

  it('bullets created by ship carry ownerId', () => {
    const s = new Ship(Team.BLUE, 400, 400, 'corvette');
    const state = { ships: [s], bullets: [], score: { red: 0, blue: 0 }, particles: [], explosions: [] };
    // Force a nearby enemy so ship will fire
    const enemy = new Ship(Team.RED, 410, 400, 'corvette');
    state.ships.push(enemy);
    // Advance simulation a bit to let ship create a bullet
    simulateStep(state, 0.1, { W: 800, H: 600 });
    const any = state.bullets.find(b => b.ownerId === s.id);
    expect(any).toBeDefined();
  });
});
