import { describe, it, expect } from 'vitest';
import { simulateStep } from '../../src/simulate/step3d';
import type { GameState3D } from '../../src/types/threeTypes';

describe('simulateStep 3D', () => {
  const bounds = {
    min: { x: 0, y: 0, z: 0 },
    max: { x: 100, y: 100, z: 100 },
    wrap: { x: true, y: true, z: true },
  };

  it('advances time and wraps positions', () => {
    const state: GameState3D = {
      ships: [
        {
          id: 'a',
          type: 'fighter',
          position: { x: 99.5, y: 50, z: 50 },
          velocity: { x: 10, y: 0, z: 0 },
          collisionRadius: 1,
        },
      ],
      t: 0,
    };

    simulateStep(state, bounds);
    expect(state.t).toBeGreaterThan(0);
    // Should wrap around x back near 0..100 range
    expect(state.ships[0].position.x).toBeGreaterThanOrEqual(0);
    expect(state.ships[0].position.x).toBeLessThan(100);
  });

  it('separates overlapping ships', () => {
    const state: GameState3D = {
      ships: [
        { id: 'a', type: 'fighter', position: { x: 10, y: 10, z: 10 }, velocity: { x: 0, y: 0, z: 0 }, collisionRadius: 4 },
        { id: 'b', type: 'fighter', position: { x: 12, y: 10, z: 10 }, velocity: { x: 0, y: 0, z: 0 }, collisionRadius: 4 },
      ],
      t: 0,
    };
    // initial distance is 2, minDist is 8; after one step they should be pushed apart a bit
    simulateStep(state, bounds);
    const dx = Math.abs(state.ships[0].position.x - state.ships[1].position.x);
    expect(dx).toBeGreaterThan(2);
  });
});
