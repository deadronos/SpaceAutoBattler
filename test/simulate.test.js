import { describe, it, expect } from 'vitest';
import { simulateStep } from '../src/simulate.js';
import { Ship, Bullet, Team } from '../src/entities.js';
import { srand } from '../src/rng.js';

describe('Simulation step', () => {
  it('bullet collides and increments score', () => {
    srand(99);
    const sEnemy = new Ship(Team.BLUE, 100, 100);
    const shooterTeam = Team.RED;
    const bullet = new Bullet(90, 100, 100, 0, shooterTeam);
    bullet.dmg = 9999; // one-shot
    const state = { ships: [sEnemy], bullets: [bullet], score: { red: 0, blue: 0 }, particles: [] };
    simulateStep(state, 0.05, { W: 800, H: 600 });
    // after update, bullet should hit and enemy dies and score increments
    expect(sEnemy.alive).toBe(false);
    expect(state.score.red).toBe(1);
  });
});
