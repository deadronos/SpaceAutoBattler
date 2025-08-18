import { describe, it, expect } from 'vitest';
import { simulateStep } from '../src/simulate.js';
import { Bullet, Team } from '../src/entities.js';

describe('Bullet culling edge cases', () => {
  it('keeps bullets just inside the cull margin', () => {
    const W = 300, H = 200;
    const b = new Bullet(-49.9, 100, 0, 0, Team.RED);
    const state = { ships: [], bullets: [b], score: { red: 0, blue: 0 }, particles: [], explosions: [] };
    simulateStep(state, 0, { W, H });
    expect(state.bullets.length).toBe(1);
  });

  it('culls bullets exactly on the margin (-50 or W+50) as alive() uses strict inequalities', () => {
    const W = 300, H = 200;
    const b1 = new Bullet(-50, 50, 0, 0, Team.RED);
    const b2 = new Bullet(W + 50, 50, 0, 0, Team.RED);
    const state = { ships: [], bullets: [b1, b2], score: { red: 0, blue: 0 }, particles: [], explosions: [] };
    simulateStep(state, 0, { W, H });
    expect(state.bullets.length).toBe(0);
  });

  it('culls bullets that move out of bounds during the update step', () => {
    const W = 200, H = 120;
    // start inside border but with velocity so it exits
    const b = new Bullet(W + 49, 60, 10, 0, Team.BLUE);
    const state = { ships: [], bullets: [b], score: { red: 0, blue: 0 }, particles: [], explosions: [] };
    // dt chosen so x will become > W+50 after update
    simulateStep(state, 0.2, { W, H });
    expect(state.bullets.length).toBe(0);
  });

  it('culls bullets near the corner correctly', () => {
    const W = 220, H = 140;
    // place bullet just inside bottom-right corner and ensure it survives
    const b = new Bullet(W + 49.9, H + 49.9, 0, 0, Team.RED);
    const state = { ships: [], bullets: [b], score: { red: 0, blue: 0 }, particles: [], explosions: [] };
    simulateStep(state, 0, { W, H });
    expect(state.bullets.length).toBe(1);

    // move it slightly outside and it should be culled
    b.x = W + 50.1; b.y = H + 50.1;
    simulateStep(state, 0, { W, H });
    expect(state.bullets.length).toBe(0);
  });

  it('culls bullets that cross diagonally with a small dt', () => {
    const W = 200, H = 120;
    // start near bottom-right edge, moving diagonally out
    const b = new Bullet(W + 48, H + 48, 15, 15, Team.BLUE);
    const state = { ships: [], bullets: [b], score: { red: 0, blue: 0 }, particles: [], explosions: [] };
    // small dt that moves the bullet just past the margin
    simulateStep(state, 0.2, { W, H });
    expect(state.bullets.length).toBe(0);
  });
});
