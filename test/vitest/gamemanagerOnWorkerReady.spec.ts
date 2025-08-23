import { test, expect } from 'vitest';

test('gm.onWorkerReady is called when worker signals ready', async () => {
  const posts: any[] = [];
  let readyCb: any = null;
  const shim = {
    createSimWorker: (url: string) => ({
      post: (m: any) => posts.push(m),
      on: (evt: string, cb: any) => { if (evt === 'ready') readyCb = cb; }
    })
  };

  const { createGameManager } = await import('../../src/gamemanager');
  const gm: any = createGameManager({ renderer: null, createSimWorker: shim.createSimWorker });

  let called = false;
  const cb = () => { called = true; };
  gm.onWorkerReady(cb);

  // there should be an init/start posted already
  expect(posts).toContainEqual(expect.objectContaining({ type: 'init' }));
  expect(posts).toContainEqual(expect.objectContaining({ type: 'start' }));

  // simulate worker signaling ready
  if (typeof readyCb === 'function') { readyCb(); }

  // manager callback should have been invoked
  expect(called).toBe(true);
  // cleanup
  gm.offWorkerReady(cb);
});
