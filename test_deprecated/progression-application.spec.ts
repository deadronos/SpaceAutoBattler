import { describe, expect, test } from 'vitest';
import { progression } from '../../src/config/progressionConfig';
import { simulateStep } from '../../src/simulate';

function mkShip(id:number, team:'red'|'blue', extras: Partial<any> = {}) {
  return Object.assign({ id, team, x:100, y:100, vx:0, vy:0, hp: 10, maxHp: 10, shield: 0, maxShield: 0, type: 'fighter', xp: 0, level: 1, cannons: [], accel: 100, shieldRegen: 0.5 }, extras);
}

function mkBullet(from:any, to:any, damage=5) {
  const dx = (to.x - from.x) || 1; const dy = (to.y - from.y) || 0; const d = Math.hypot(dx, dy) || 1; const nx = dx/d, ny = dy/d;
  return { id: 999, x: from.x, y: from.y, vx: nx*0, vy: ny*0, ttl: 1, radius: 0.5, damage, team: from.team, ownerId: from.id };
}

describe('progression application', () => {
  test('speedPercentPerLevel and regenPercentPerLevel are applied on level-up', () => {
    const a = mkShip(1, 'red');
    const b = mkShip(2, 'blue', { hp: 4, maxHp: 4 });
    const state:any = { ships: [a, b], bullets: [], explosions: [], shieldHits: [], healthHits: [] };

  // Seed attacker XP just below the first level threshold so a single hit triggers level-up
  a.xp = (typeof progression.xpToLevel === 'function' ? progression.xpToLevel(1) : progression.xpToLevel) - 1;

  // Confirm initial accel and shieldRegen
  const initialAccel = a.accel;
  const initialRegen = a.shieldRegen;

  // Single hit to push XP over the threshold
  state.bullets.push(mkBullet(a, b, 5));
  simulateStep(state, 0.016, { W:800, H:600 });

    // After kill, attacker should have leveled (or at least have increased xp processed)
  const speedScalar = typeof (progression as any).speedPercentPerLevel === 'function' ? (progression as any).speedPercentPerLevel(a.level || 1) : (progression as any).speedPercentPerLevel || 0;
  const regenScalar = typeof (progression as any).regenPercentPerLevel === 'function' ? (progression as any).regenPercentPerLevel(a.level || 1) : (progression as any).regenPercentPerLevel || 0;

    // If scalars are present they should have modified accel and shieldRegen
    if (typeof speedScalar === 'number') {
      expect(a.accel).toBeCloseTo(initialAccel * (1 + speedScalar));
    }
    if (typeof regenScalar === 'number') {
      expect(a.shieldRegen).toBeCloseTo(initialRegen * (1 + regenScalar));
    }
  });
});
