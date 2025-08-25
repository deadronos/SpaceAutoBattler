import { describe, it, expect } from 'vitest';
import { makeInitialState } from '../../src/entities';
import { applySimpleAI } from '../../src/behavior';
import { simulateStep } from '../../src/simulate';

describe('turret firing origin', () => {
  it('spawns bullet at tuple-style turret mountpoint (rotated + scaled by radius)', () => {
    const state: any = makeInitialState();
    // Attacker has a single turret defined as tuple [1,0] (right side)
  // Use a non-configured type so getShipConfig()[type] is undefined and
  // behavior falls back to the ship.radius value we set (10).
  const attacker: any = { id: 1, x: 50, y: 50, angle: 0, radius: 10, type: 'unknown-type', hp: 10, maxHp: 10, team: 'red', turrets: [[1, 0]] };
    // Defender sits to the right so AI will engage and fire from turret
    const defender: any = { id: 2, x: 80, y: 50, angle: 0, radius: 12, hp: 10, maxHp: 10, team: 'blue' };
    state.ships = [attacker, defender];
    // Call AI step which should issue firing (applySimpleAI triggers tryFire when engaging)
    // Run with a dt large enough that turret cooldowns allow a shot (1s)
    applySimpleAI(state, 1.0, { W: 200, H: 200 });
    // Expect at least one bullet created
    expect(Array.isArray(state.bullets)).toBe(true);
    expect(state.bullets.length).toBeGreaterThan(0);
    const b = state.bullets[0];
    // turret tuple [1,0] with ship.radius=10 and angle=0 should spawn at x = 50 + 1*10, y = 50
    expect(Math.abs(b.x - (50 + 1 * 10))).toBeLessThan(1e-6);
    expect(Math.abs(b.y - 50)).toBeLessThan(1e-6);
  });
});
