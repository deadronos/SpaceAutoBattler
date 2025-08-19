import { describe, it, expect, beforeEach } from 'vitest';
import { srand } from '../src/rng.js';
import { Ship, Bullet, Team, getClassConfig, createShipWithConfig } from '../src/entities.js';
import { simulateStep } from '../src/simulate.js';

describe('Progression and XP', () => {
  beforeEach(() => { srand(42); });

  it('awards XP to the owner on damage', () => {
    const attackerCfg = getClassConfig('corvette');
    const targetCfg = getClassConfig('corvette');
    const attacker = createShipWithConfig(Team.RED, 100, 100, 'corvette', attackerCfg);
    const target = createShipWithConfig(Team.BLUE, 110, 100, 'corvette', targetCfg);
    // ensure a bullet from attacker hits target
    const b = new Bullet(attacker.x, attacker.y, 10, 0, attacker.team, attacker.id);
    b.dmg = 10;
    const state = { ships: [attacker, target], bullets: [b], score: { red: 0, blue: 0 }, particles: [], explosions: [] };
    simulateStep(state, 0.016, { W: 800, H: 600 });
    // attacker should gain XP_PER_DAMAGE * dmg (config default 0.05*10 = 0.5)
    expect(attacker.xp).toBeGreaterThan(0);
  });

  it('awards kill XP to the owner on kill', () => {
    const attackerCfg = getClassConfig('destroyer');
    const targetCfg = getClassConfig('fighter');
    const attacker = createShipWithConfig(Team.RED, 200, 200, 'destroyer', attackerCfg);
    const target = createShipWithConfig(Team.BLUE, 205, 200, 'fighter', targetCfg);
    // big bullet to kill
  const b = new Bullet(attacker.x, attacker.y, 10, 0, attacker.team, attacker.id);
    b.dmg = 9999;
    const state = { ships: [attacker, target], bullets: [b], score: { red: 0, blue: 0 }, particles: [], explosions: [] };
    simulateStep(state, 0.016, { W: 800, H: 600 });
    expect(attacker.xp).toBeGreaterThanOrEqual(20); // at least the base kill XP
    expect(target.alive).toBe(false);
  });

  it('levels up when xp threshold reached and scales hp and shield', () => {
    const sCfg = getClassConfig('frigate');
    const s = createShipWithConfig(Team.RED, 300, 300, 'frigate', sCfg);
    const baseHp = s.baseHpMax;
    const baseShield = s.shieldMax;
    // artificially grant xp enough for several levels
  s.gainXp(1000);
    expect(s.level).toBeGreaterThan(1);
    expect(s.hpMax).toBeGreaterThanOrEqual(baseHp);
    expect(s.shieldMax).toBeGreaterThanOrEqual(baseShield);
  });

  it('bullets created by ship carry ownerId', () => {
    const sCfg = getClassConfig('corvette');
    const enemyCfg = getClassConfig('corvette');
    const s = createShipWithConfig(Team.BLUE, 400, 400, 'corvette', sCfg);
    const state = { ships: [s], bullets: [], score: { red: 0, blue: 0 }, particles: [], explosions: [] };
    // Force a nearby enemy so ship will fire
  const enemy = createShipWithConfig(Team.RED, 410, 400, 'corvette', enemyCfg);
    state.ships.push(enemy);
    // Advance simulation a bit to let ship create a bullet
    simulateStep(state, 0.1, { W: 800, H: 600 });
    const any = state.bullets.find(b => b.ownerId === s.id);
    expect(any).toBeDefined();
  });
});
