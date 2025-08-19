import { describe, it, expect } from 'vitest';
import { simulateStep } from '../src/simulate.js';
import { Ship, Team, getClassConfig, createShipWithConfig } from '../src/entities.js';

describe('Screen wrapping in simulation', () => {
  it('wraps ships left->right and right->left', () => {
    const W = 200, H = 120;
  const ship = createShipWithConfig(Team.RED, 0, 50, 'corvette', getClassConfig('corvette'));
    const r = ship.radius; // corvette radius is deterministic (8)

    // place slightly off the left edge
    const leftX = -(r + 5);
    ship.x = leftX;
    const state = { ships: [ship], bullets: [], score: { red: 0, blue: 0 }, particles: [], explosions: [] };
    simulateStep(state, 0, { W, H });
    expect(ship.x).toBe(leftX + (W + r * 2));

    // place slightly off the right edge
    const rightX = W + r + 7;
    ship.x = rightX;
    simulateStep(state, 0, { W, H });
    expect(ship.x).toBe(rightX - (W + r * 2));
  });

  it('wraps ships top->bottom and bottom->top', () => {
    const W = 200, H = 120;
  const ship = createShipWithConfig(Team.RED, 60, 0, 'corvette', getClassConfig('corvette'));
    const r = ship.radius;

    // slightly above top
    const topY = -(r + 6);
    ship.y = topY;
    const state = { ships: [ship], bullets: [], score: { red: 0, blue: 0 }, particles: [], explosions: [] };
    simulateStep(state, 0, { W, H });
    expect(ship.y).toBe(topY + (H + r * 2));

    // slightly below bottom
    const bottomY = H + r + 9;
    ship.y = bottomY;
    simulateStep(state, 0, { W, H });
    expect(ship.y).toBe(bottomY - (H + r * 2));
  });

  it('does not wrap bullets (they are culled when out of bounds)', () => {
    const W = 120, H = 80;
    // create a bullet placed well outside the right edge
    const b = { x: W + 200, y: 40, vx: 0, vy: 0, life: 1, radius: 2, dmg: 1, update(dt){}, alive(bounds){ return this.x>-50 && this.x<bounds.W+50 && this.y>-50 && this.y<bounds.H+50; } };
    const state = { ships: [], bullets: [b], score: { red: 0, blue: 0 }, particles: [], explosions: [] };
    simulateStep(state, 0, { W, H });
    // bullet should be removed (culled) because it's out of bounds
    expect(state.bullets.length).toBe(0);
  });
});
