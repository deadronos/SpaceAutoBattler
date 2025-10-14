import { describe, it, expect } from 'vitest';
import { safeSnapshot, isWasmBacked } from '../src/game/safeSnapshot.js';

describe('safeSnapshot utilities', () => {
  it('sanitizes a fake state and avoids WASM objects', () => {
    class FakeRigidBody {}
    const fakeRigid = new FakeRigidBody();

    const mockState: any = {
      time: 1.23,
      simulation: { lastTickIndex: 5, lastTickDuration: 0.05, accumulator: 0, deferredMutations: [], postStepMutations: [] },
      world: { entities: [{}, {}, {}] },
      queries: {
        ships: { entities: [] },
        projectiles: { entities: [] },
        turrets: { entities: [] },
        beamVisuals: { entities: [] },
      },
      colliderLookup: new Map([[1, {}]]),
      ai: { tickIndex: 2, cursor: 7 },
      blackboard: { teamCounts: { blue: 2, red: 1 } },
      // Attach a WASM-like object to ensure it is not traversed
      physicsWorld: fakeRigid,
    };

    const snap = safeSnapshot(mockState as any);
    expect(snap.time).toBe(1.23);
    expect((snap as any).counts.entities).toBe(3);
    expect((snap as any).counts.colliders).toBe(1);
    // WASM object should be ignored and not cause thrown errors
    expect(isWasmBacked(fakeRigid)).toBe(true);
  });
});
