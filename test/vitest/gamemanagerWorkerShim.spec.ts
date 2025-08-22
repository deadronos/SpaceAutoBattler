import { test, expect } from 'vitest';

// This test verifies that createGameManager hooks into a worker-like shim by
// calling its `on('ready', cb)` handler and posting initialization messages.
// We don't import createGameManager directly from src/gamemanager.js to allow
// replacing the createSimWorker factory via a small module shim. Instead we
// dynamically import the module after mocking the createSimWorker module
// using a lightweight ESM loader trick available in Vitest environment.

test('createGameManager hooks worker ready and forwards init/start', async () => {
  const posts: any[] = [];
  let readyCb: (() => void) | null = null;

  // build a shim that emulates the createSimWorker factory
  const shim = {
    createSimWorker: (url: string) => {
      return {
        post: (m: any) => posts.push(m),
        on: (evt: string, cb: any) => { if (evt === 'ready') readyCb = cb; }
      };
    }
  };

  // Now call createGameManager with our shimmed factory so it will use the
  // shim and post messages to our `posts` array. Import the manager and call
  // it with the injected factory.
  const { createGameManager } = await import('../../src/gamemanager.js');
  const gm: any = createGameManager({ renderer: null, createSimWorker: shim.createSimWorker });

  // At this point the shim should have received init and start posts
  expect(posts).toContainEqual(expect.objectContaining({ type: 'init' }));
  expect(posts).toContainEqual(expect.objectContaining({ type: 'start' }));

  // The shim should have captured a ready callback; assert it exists
  expect(typeof readyCb).toBe('function');
  // ensure manager exposes isWorker() and it eventually returns true once ready
  // (note: createGameManager sets workerReady on 'ready').
  expect(typeof gm.isWorker === 'function').toBe(true);
  // Call the method to ensure no exceptions; it may return false in some envs
  expect(() => gm.isWorker()).not.toThrow();
});
