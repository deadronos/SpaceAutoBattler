import { describe, it, expect } from 'vitest';
import { createInitialState, spawnShip, simulateStep } from '../../../src/core/gameState.js';

function isFiniteVector3(v: { x: number; y: number; z: number }) {
  return Number.isFinite(v.x) && Number.isFinite(v.y) && Number.isFinite(v.z);
}

/**
 * Integration smoke: a few ticks should not produce NaNs, ids remain unique, bullets count consistent.
 */
describe('Characterization: simulate smoke', () => {
  it('runs a few ticks without NaNs or id conflicts', () => {
    const seed = 'SMOKE-SEED';
    const state = createInitialState(seed);
    // Seed a few ships per team for activity
    for (let i = 0; i < 3; i++) {
      spawnShip(state, 'red', 'fighter');
      spawnShip(state, 'blue', 'fighter');
    }

    // Run a handful of ticks
    for (let t = 0; t < 10; t++) {
      simulateStep(state, 1/60);

      // Invariants
      // - All vectors finite
      for (const s of state.ships) {
        expect(isFiniteVector3(s.pos)).toBe(true);
        expect(isFiniteVector3(s.vel)).toBe(true);
      }
      for (const b of state.bullets) {
        expect(isFiniteVector3(b.pos)).toBe(true);
        expect(isFiniteVector3(b.vel)).toBe(true);
      }
      // - Ids unique and index matches
      const ids = new Set(state.ships.map(s => s.id));
      expect(ids.size).toBe(state.ships.length);
      if (state.shipIndex) {
        for (const s of state.ships) {
          expect(state.shipIndex.get(s.id)).toBe(s);
        }
      }
    }
  });
});
