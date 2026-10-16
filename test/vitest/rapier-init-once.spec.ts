import { describe, it, expect, vi } from 'vite-plus/test';
import { createGameState } from '../../src/game/state.js';
import { createInitOnce } from '../../src/game/physics/rapierInit.js';

// rapier3d-compat's `init()` only records the WASM exports after instantiation resolves, so
// overlapping calls (e.g. React StrictMode mounting GameProvider twice) instantiate the module
// twice and the later instance silently replaces the one existing worlds were built on.
describe('createInitOnce', () => {
  it('shares one in-flight initialisation between concurrent callers', async () => {
    let resolve!: () => void;
    const init = vi.fn(() => new Promise<void>((r) => (resolve = r)));
    const ensure = createInitOnce(init);

    const first = ensure();
    const second = ensure();
    resolve();
    await Promise.all([first, second]);
    await ensure();

    expect(init).toHaveBeenCalledTimes(1);
  });

  it('allows a retry after a failed initialisation', async () => {
    const init = vi
      .fn<() => Promise<void>>()
      .mockRejectedValueOnce(new Error('wasm fetch failed'))
      .mockResolvedValueOnce(undefined);
    const ensure = createInitOnce(init);

    await expect(ensure()).rejects.toThrow('wasm fetch failed');
    await expect(ensure()).resolves.toBeUndefined();
    expect(init).toHaveBeenCalledTimes(2);
  });
});

describe('createGameState', () => {
  it('builds working physics worlds when called concurrently', async () => {
    const states = await Promise.all([createGameState(), createGameState()]);
    for (const state of states) {
      expect(() => state.physicsWorld.step()).not.toThrow();
    }
  });
});
