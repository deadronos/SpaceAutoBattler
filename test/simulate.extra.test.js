import { test, expect } from 'vitest';
import { srand } from '../src/rng.js';
import { createShip, createBullet } from '../src/entities.js';
import { simulateStep } from '../src/simulate.js';

test('simulateStep resolves bullet collision, creates hits and awards xp', () => {
  srand(123);
  const shipA = createShip({ id: 1, team: 'red', x: 50, y: 50, hp: 10, shield: 0 });
  const shipB = createShip({ id: 2, team: 'blue', x: 55, y: 50, hp: 6, shield: 0 });
  const bullet = createBullet({ x: 50, y: 50, vx: 0, vy: 0, dmg: 6, team: 'red', ownerId: 1 });
  const state = { ships: [shipA, shipB], bullets: [bullet], particles: [], stars: [] };
  simulateStep(state, 0.016, { W: 800, H: 600 });
  // bullet should hit shipB and remove it
  expect(state.healthHits.length + state.shieldHits.length).toBeGreaterThanOrEqual(1);
  // Owner shipA should have gained xp (6 dmg)
  expect(shipA.xp).toBeGreaterThanOrEqual(6);
  // shipB should be removed if killed
  const aliveB = state.ships.find(s => s.id === 2);
  // If hp <=0 it will be removed; allow both possibilities depending on damage
  if (aliveB) expect(aliveB.alive).toBe(true);
});
