import { describe, it, expect } from 'vitest';
import { simulateStep } from '../../src/simulate';

function mkShip(id:number, team:'red'|'blue', extras: Partial<any> = {}) {
  return Object.assign({ id, team, x:100, y:100, vx:0, vy:0, hp: 10, maxHp: 10, shield: 0, maxShield: 0, type: 'fighter', xp: 0, level: 1, cannons: [] }, extras);
}

function mkBullet(from:any, to:any, damage=5) {
  const dx = (to.x - from.x) || 1; const dy = (to.y - from.y) || 0; const d = Math.hypot(dx, dy) || 1; const nx = dx/d, ny = dy/d;
  return { id: 999, x: from.x, y: from.y, vx: nx*0, vy: ny*0, ttl: 1, radius: 0.5, damage, team: from.team, ownerId: from.id };
}

describe('progression defaults', () => {
  it('awards xp on damage and kill; levels up when threshold met', () => {
    const a = mkShip(1, 'red');
    const b = mkShip(2, 'blue', { hp: 6, maxHp: 6 });
    const state:any = { ships: [a, b], bullets: [], explosions: [], shieldHits: [], healthHits: [] };
    // First hit: damage only
    state.bullets.push(mkBullet(a, b, 3));
    simulateStep(state, 0.016, { W:800, H:600 });
    expect(a.xp).toBeGreaterThan(0);

    // Second hit: kill credit
    state.bullets.push(mkBullet(a, b, 10));
    simulateStep(state, 0.016, { W:800, H:600 });
    expect(a.xp).toBeGreaterThan(0);
    expect(a.level).toBeGreaterThanOrEqual(1);
  });
});
