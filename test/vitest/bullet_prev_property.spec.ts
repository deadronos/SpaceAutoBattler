import { describe, it, expect } from 'vitest';
import { makeInitialState, createBullet } from '../../src/entities';
import { simulateStep } from '../../src/simulate';
import { getDefaultBounds } from '../../src/config/simConfig';

// Ensure bullets initialize and simulatePath sets both prevX/prevY and _prevX/_prevY

describe('Bullet previous position fields', () => {
  it('initializes both prevX and _prevX and they remain consistent after simulateStep', () => {
    const state = makeInitialState();
    const b = createBullet(10, 20, 5, 0, 'red', null, 1, 2.0);
    state.bullets.push(b as any);
    // initial fields present
    expect(typeof (b as any).prevX === 'number').toBeTruthy();
    expect(typeof (b as any)._prevX === 'number').toBeTruthy();
    // run a small step
  const bounds = getDefaultBounds();
  simulateStep(state as any, 0.016, bounds);
    const nb = state.bullets[0] as any;
    // after simulate, both legacy and internal fields should be present and numeric
    expect(typeof nb.prevX === 'number').toBeTruthy();
    expect(typeof nb._prevX === 'number').toBeTruthy();
    // values should be equal (synchronized)
    expect(nb.prevX === nb._prevX).toBeTruthy();
  });
});