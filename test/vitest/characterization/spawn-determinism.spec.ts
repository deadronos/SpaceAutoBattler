import { describe, it, expect } from 'vitest';
import { createInitialState, spawnShip } from '../../../src/core/gameState.js';
import type { Vector3 } from '../../../src/types/index.js';

/**
 * Characterization test: spawning a ship is deterministic for a fixed seed.
 */
describe('Characterization: spawn determinism', () => {
  it('spawns with deterministic id and position for a fixed seed', () => {
    const seed = 'TEST-SEED-1234';
    const s1 = createInitialState(seed);
    const s2 = createInitialState(seed);

    const a1 = spawnShip(s1, 'red', 'fighter');
    const a2 = spawnShip(s2, 'red', 'fighter');

    // ids should match and start at 1
    expect(a1.id).toBe(1);
    expect(a2.id).toBe(1);

    // positions should match exactly for equal seeds
    const p1: Vector3 = a1.pos; const p2: Vector3 = a2.pos;
    expect(p1.x).toBe(p2.x);
    expect(p1.y).toBe(p2.y);
    expect(p1.z).toBe(p2.z);

    // second spawn increments ids and yields deterministic positions
    const b1 = spawnShip(s1, 'blue', 'fighter');
    const b2 = spawnShip(s2, 'blue', 'fighter');
    expect(b1.id).toBe(2);
    expect(b2.id).toBe(2);
    expect(b1.pos.x).toBe(b2.pos.x);
    expect(b1.pos.y).toBe(b2.pos.y);
    expect(b1.pos.z).toBe(b2.pos.z);
  });
});
