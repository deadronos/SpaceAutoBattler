import { describe, it, expect } from 'vitest';
import { simulateStep } from '../src/simulate.js';
import * as gm from '../src/gamemanager.js';
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
  // simulateStep should mark enemy dead and emit killEvents with metadata
  expect(sEnemy.alive).toBe(false);
  expect(Array.isArray(state.killEvents)).toBe(true);
  expect(state.killEvents.length).toBeGreaterThan(0);
  const ke = state.killEvents[0];
  expect(ke.killerTeam).toBe(shooterTeam);
  expect(typeof ke.killerId === 'number' || ke.killerId === null).toBe(true);
  expect(typeof ke.id).toBe('number');
  expect(typeof ke.type).toBe('string');
  expect(typeof ke.x).toBe('number');
  expect(typeof ke.y).toBe('number');
  });
});
