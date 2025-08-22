import { describe, it, expect } from 'vitest';

// Test that gamemanager.simulate() converts raw explosion events into
// the exported `flashes` buffer exactly once per explosion (no duplication
// across subsequent simulate() calls when no new explosions are emitted).

import * as gm from '../../src/gamemanager';
import { createShip, createBullet } from '../../src/entities';

describe('gamemanager explosion -> flashes merge', () => {
  it('merges explosion events into flashes exactly once', () => {
    // start from a clean manager state
    gm.reset(12345);

    // ensure module-level arrays are empty
    expect(Array.isArray(gm.flashes)).toBe(true);
    gm.flashes.length = 0;

    // Create attacker and victim using the factory to ensure shape
    const attacker = createShip('fighter', 90, 100, 'red');
    const victim = createShip('fighter', 100, 100, 'blue');
    // weak victim so single bullet kills
    victim.hp = 1; victim.maxHp = 1; victim.shield = 0; victim.maxShield = 0;

    // push into manager-level ships array
    gm.ships.length = 0; gm.bullets.length = 0; gm.particles.length = 0;
    gm.ships.push(attacker, victim);

    // bullet at same position to hit and kill victim
    const b = createBullet(100, 100, 0, 0, 'red', attacker.id, 5, 1.0);
    gm.bullets.push(b);

    // run one simulate step (this should detect the collision and create an explosion)
    const snap1 = gm.simulate(1 / 60, 800, 600);
    // snapshot includes flashes array referencing gm.flashes
    expect(Array.isArray(snap1.flashes)).toBe(true);
    const firstCount = snap1.flashes.length;
    expect(firstCount).toBeGreaterThanOrEqual(1);

    // Run a second simulate step without adding new explosions - flashes should not gain duplicates
    const snap2 = gm.simulate(1 / 60, 800, 600);
    const secondCount = snap2.flashes.length;

    // The second snapshot's flashes length should be >= firstCount (flashes persist but should not newly duplicate the same explosion)
    // To be conservative: ensure the difference is zero (no new explosions were added)
    expect(secondCount - firstCount).toBe(0);
  });
});
