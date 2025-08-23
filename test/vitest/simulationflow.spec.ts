import { describe, it, expect } from 'vitest';
import { simulateStep, SIM_DT_MS } from '../../src/simulate';
import { makeInitialState, createShip, createBullet } from '../../src/entities';
import progression from '../../src/config/progressionConfig';
import ShipConfig from '../../src/config/entitiesConfig';

describe('Simulation Flow', () => {
  it('should advance time and move entities', () => {
    const state = makeInitialState();
    const ship = createShip('fighter', 100, 100, 'red');
    ship.vx = 10; ship.vy = 0;
    state.ships.push(ship);
    simulateStep(state, 1, { W: 1920, H: 1080 });
    expect(ship.x).toBeGreaterThan(100);
    expect(ship.y).toBe(100);
    expect(state.t).toBe(1);
  });

  it('should handle bullet collisions and damage', () => {
    const state = makeInitialState();
    const ship = createShip('fighter', 100, 100, 'red');
    const target = createShip('fighter', 110, 100, 'blue');
    state.ships.push(ship, target);
    const bullet = createBullet(110, 100, 0, 0, 'red', ship.id, 10, 1);
    state.bullets.push(bullet);
    simulateStep(state, 0.1, { W: 1920, H: 1080 });
    expect(target.hp).toBeLessThan(target.maxHp);
    expect(state.bullets.length).toBe(0);
  });

  it('should award XP and level up on kill', () => {
    const state = makeInitialState();
    const ship = createShip('fighter', 100, 100, 'red');
    const target = createShip('fighter', 100, 100, 'blue');
    state.ships.push(ship, target);
    // Remove all cannons from target to ensure only one bullet is created
    target.cannons = [];
    const bullet = createBullet(100, 100, 0, 0, 'red', ship.id, target.maxHp, 1);
    state.bullets.push(bullet);
    simulateStep(state, 0.1, { W: 1920, H: 1080 });
    expect(target.hp).toBeLessThanOrEqual(0);
    expect(ship.xp).toBeGreaterThanOrEqual(progression.xpPerKill);
    expect(ship.level).toBeGreaterThan(1);
    expect(state.bullets.length).toBe(0);
  });
});
