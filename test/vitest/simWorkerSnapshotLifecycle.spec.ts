import { describe, it, expect } from 'vitest';

// This test emulates the worker snapshot lifecycle in an integrated way
// without spawning a real Worker. It uses the same logic sequence the
// worker follows: mutate the internal state (simulate collision), call
// postSnapshot (simulated), then verify the transient event arrays are
// cleared so subsequent snapshots don't contain duplicate events.

import { simulateStep } from '../../src/simulate';
import { clearTransientEvents } from '../../src/simWorker';

describe('simWorker snapshot lifecycle (integrated)', () => {
  it('sends an explosion once and does not duplicate across snapshots', () => {
    // Create a fake worker state similar to what's used in the worker
    const state: any = {
      t: 0,
      ships: [],
      bullets: [],
      explosions: [],
      shieldHits: [],
      healthHits: []
    };

    // Create a scenario where a bullet kills a ship in one simulateStep
    const ship = { id: 1, x: 100, y: 100, vx: 0, vy: 0, hp: 1, maxHp: 1, shield: 0, maxShield: 0, team: 'blue', radius: 6 };
    const attacker = { id: 2, x: 90, y: 100, vx: 0, vy: 0, hp: 10, maxHp: 10, shield: 0, team: 'red', xp: 0, level: 1 };
    state.ships.push(attacker);
    state.ships.push(ship);

    // bullet positioned to hit the ship
    const bullet = { id: 3, x: 100, y: 100, vx: 0, vy: 0, team: 'red', ownerId: attacker.id, damage: 5, ttl: 1.0 };
    state.bullets.push(bullet);

    // Run one simulate step which should detect collision, remove ship, and push an explosion
    simulateStep(state, 1 / 60, { W: 800, H: 600 });

    // At this point worker would post snapshot containing the explosion
    expect(Array.isArray(state.explosions)).toBe(true);
    expect(state.explosions.length).toBeGreaterThanOrEqual(1);

    // Emulate postSnapshot which clones the state snapshot and then clears transient events
    const snapshot = JSON.parse(JSON.stringify(state));
    // The snapshot should contain the explosion event
    expect(Array.isArray(snapshot.explosions)).toBe(true);
    expect(snapshot.explosions.length).toBeGreaterThanOrEqual(1);

    // Now emulate the worker clearing transient events after posting
    clearTransientEvents(state);

    // Worker state after clearing should have no transient events
    expect(state.explosions.length).toBe(0);
    expect(state.shieldHits.length).toBe(0);
    expect(state.healthHits.length).toBe(0);

    // Emulate a second snapshot being taken (no new events were added)
    const snapshot2 = JSON.parse(JSON.stringify(state));
    expect(Array.isArray(snapshot2.explosions)).toBe(true);
    expect(snapshot2.explosions.length).toBe(0);
  });
});
