import { describe, it, expect } from 'vitest';
import { createGameManager } from '../../src/gamemanager';

// Quick deterministic spawn test
// - Reseed the manager
// - Spawn a known sequence of ship types for a team
// - Record positions
// - Reseed with the same seed and repeat; positions should match
// - Reseed with a different seed and repeat; positions should differ

function recordSpawns(gm: any, team: string, types: string[]) {
  const spawned: Array<{ x: number; y: number; type: string }> = [];
  for (const t of types) {
    const s = gm.spawnShip(team, t);
    if (s) spawned.push({ x: s.x, y: s.y, type: s.type || t });
  }
  return spawned;
}

describe('deterministic spawn', () => {
  it('reseed + spawn yields deterministic positions for same seed', () => {
    const gm1 = createGameManager({ useWorker: false, seed: 0 });
    gm1.reseed(0);
    const types = ['fighter', 'corvette', 'frigate', 'destroyer', 'carrier'];
    const a = recordSpawns(gm1, 'red', types);

    // Reseed and spawn again
    const gm2 = createGameManager({ useWorker: false, seed: 0 });
    gm2.reseed(0);
    const b = recordSpawns(gm2, 'red', types);

    expect(a.length).toBe(b.length);
    for (let i = 0; i < a.length; i++) {
      // Use strict equality to ensure positions match exactly from seeded PRNG
      expect(a[i].x).toBe(b[i].x);
      expect(a[i].y).toBe(b[i].y);
      expect(a[i].type).toBe(b[i].type);
    }
  });

  it('different seeds produce different positions (very likely)', () => {
    const gm1 = createGameManager({ useWorker: false, seed: 42 });
    gm1.reseed(42);
    const types = ['fighter', 'corvette', 'frigate'];
    const a = recordSpawns(gm1, 'blue', types);

    const gm2 = createGameManager({ useWorker: false, seed: 43 });
    gm2.reseed(43);
    const b = recordSpawns(gm2, 'blue', types);

    // It's possible (but extremely unlikely) that all positions match; test for at least one mismatch.
    const allMatch = a.every((v, i) => v.x === b[i].x && v.y === b[i].y && v.type === b[i].type);
    expect(allMatch).toBe(false);
  });
});
