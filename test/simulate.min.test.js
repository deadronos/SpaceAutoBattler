import { describe, it, expect } from 'vitest';
import { simulateStep } from '../src/simulate.js';
import { createShip, createBullet } from '../src/entities.js';

describe('simulateStep (minimal)', () => {
  it('updates ships and wraps positions', () => {
    const s = createShip({ x: 0, y: 0, vx: 100, vy: 0 });
    const state = { ships: [s], bullets: [] };
    simulateStep(state, 0.02, { W: 50, H: 50 });
    expect(state.ships[0].x).toBeGreaterThan(0);
  });

  it('bullet collides with ship and emits events', () => {
    const target = createShip({ x: 100, y: 100, team: 'blue', hp: 5, shield: 0 });
    const b = createBullet({ x: 90, y: 100, vx: 100, vy: 0, team: 'red', dmg: 10, ownerId: 999 });
    const state = { ships: [target], bullets: [b], explosions: [], shieldHits: [], healthHits: [] };
    simulateStep(state, 0.2, { W: 800, H: 600 });
    expect(state.explosions.length + state.healthHits.length + state.shieldHits.length).toBeGreaterThanOrEqual(1);
  });
});
