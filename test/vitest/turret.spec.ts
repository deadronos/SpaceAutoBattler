import { describe, it, expect } from 'vitest';
import { makeInitialState } from '../../src/entities';
import { simulateStep } from '../../src/simulate';

describe('turret simulation', () => {
  it('advances turret.angle toward targetAngle by at most turnRate * dt', () => {
    const state = makeInitialState();
    // Two ships: attacker with a turret, defender
    const attacker: any = { id: 1, x: 50, y: 50, angle: 0, radius: 12, hp: 10, maxHp: 10, team: 'red', turrets: [{ position: [1,0], angle: 0, targetAngle: Math.PI / 2, turnRate: Math.PI }] };
    const defender: any = { id: 2, x: 60, y: 60, angle: 0, radius: 12, hp: 10, maxHp: 10, team: 'blue' };
    state.ships = [attacker, defender];
    // step with dt = 0.5s, max rotation = PI * 0.5 = 1.5708
    simulateStep(state, 0.5, { W: 200, H: 200 });
    const t = (state.ships[0] as any).turrets[0];
    expect(typeof t.angle).toBe('number');
    // angle should have moved from 0 toward PI/2 but not exceeded it
    expect(t.angle).toBeGreaterThan(0);
    expect(t.angle).toBeLessThanOrEqual(Math.PI / 2 + 1e-6);
  });

  it('basic AI sets turret.targetAngle toward nearest enemy', () => {
    const state = makeInitialState();
    const attacker: any = { id: 1, x: 10, y: 10, angle: 0, radius: 12, hp: 10, maxHp: 10, team: 'red', turrets: [{ position: [1,0], angle: 0 }] };
    const enemy: any = { id: 2, x: 20, y: 10, angle: 0, radius: 12, hp: 10, maxHp: 10, team: 'blue' };
    state.ships = [attacker, enemy];
    // run one simulate step which should set targetAngle via AI
    simulateStep(state, 0.016, { W: 200, H: 200 });
    const t = (state.ships[0] as any).turrets[0];
    expect(typeof t.targetAngle).toBe('number');
    // targetAngle should point roughly at enemy (0 radians since enemy is directly +X)
    expect(Math.abs(t.targetAngle)).toBeLessThan(0.1);
  });
});
