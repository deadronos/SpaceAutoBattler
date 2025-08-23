import { describe, it, expect } from 'vitest';

// Verify that the worker helper clears transient event arrays after snapshot
describe('simWorker clearTransientEvents', () => {
  it('clears explosions, shieldHits, and healthHits arrays', async () => {
  const mod = await import('../../src/simWorker');
    expect(mod).toBeTruthy();
    // prepare a fake state with transient arrays
    const state: any = { explosions: [{ x: 1 }], shieldHits: [{ id: 2 }], healthHits: [{ id: 3 }] };
    // Sanity before
    expect(state.explosions.length).toBe(1);
    expect(state.shieldHits.length).toBe(1);
    expect(state.healthHits.length).toBe(1);

    // call exported helper
    if (typeof mod.clearTransientEvents === 'function') {
      mod.clearTransientEvents(state);
    } else {
      // In case the module didn't export, fail the test to make sure API exists
      throw new Error('clearTransientEvents not exported from simWorker');
    }

    // arrays should be cleared
    expect(state.explosions.length).toBe(0);
    expect(state.shieldHits.length).toBe(0);
    expect(state.healthHits.length).toBe(0);
  });
});
