import { describe, it, expect } from 'vitest';
import { makeInitialState, createShip } from '../../src/entities';
import { simulateStep } from '../../src/simulate';

// Test carrier spawning: carrier should spawn fighters per cooldown up to maxFighters

describe('Carrier spawn behavior', () => {
  it('spawns fighters up to maxFighters and respects spawnPerCooldown', () => {
    const state = makeInitialState();
    const carrier = createShip('carrier', 400, 300, 'red');
    state.ships.push(carrier);

    // Advance time enough to trigger multiple spawns
    const dt = 0.2; // 200ms per step
    for (let i = 0; i < 50; i++) {
      simulateStep(state as any, dt, { W: 800, H: 600 });
    }
    const fighters = (state.ships || []).filter((s: any) => s && s.parentId === carrier.id && s.type === 'fighter');
    // Carrier config: maxFighters = 6
    expect(fighters.length).toBeLessThanOrEqual(6);
    expect(fighters.length).toBeGreaterThan(0);
  });
});
