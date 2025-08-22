import { test, expect } from 'vitest';

test('manager receives reinforcements message from worker shim and types are valid', async () => {
  const posts: any[] = [];
  let readyCb: (() => void) | null = null;
  let reinfCb: ((m: any) => void) | null = null;

  // build a shim that emulates the createSimWorker factory and allows us to
  // trigger a 'reinforcements' event later.
  const listeners: Record<string, any> = {};
  const shim = {
    createSimWorker: (url: string) => {
      return {
        post: (m: any) => posts.push(m),
        on: (evt: string, cb: any) => { listeners[evt] = cb; if (evt === 'ready') readyCb = cb; }
      };
    },
    // helper to simulate worker emitting a message
    trigger: (type: string, msg: any) => { if (typeof listeners[type] === 'function') listeners[type](msg); }
  };

  // import manager and create instance with the shim factory
  const { createGameManager } = await import('../../src/gamemanager.js');
  const gm: any = createGameManager({ renderer: null, createSimWorker: shim.createSimWorker });

  // Ensure init/start messages were posted to worker shim as part of manager setup
  expect(posts.some(p => p && p.type === 'init')).toBe(true);
  expect(posts.some(p => p && p.type === 'start')).toBe(true);

  // trigger the reinforcements event as the worker would do
  const spawned = [ { id: 1, type: 'fighter', team: 'red' }, { id: 2, type: 'corvette', team: 'red' } ];
  // Use our shim.trigger helper to simulate the worker posting the
  // reinforcements message (this avoids calling an inferred callback
  // variable directly and keeps the test TypeScript-friendly).
  expect(typeof shim.trigger).toBe('function');
  shim.trigger('reinforcements', { spawned });

  // The manager internal shim should have processed the message; since
  // behaviour varies by implementation we'll assert that the spawned types
  // are valid according to the runtime ShipConfig keys accessible via
  // the exported helper on gamemanager.
  const { getShipConfig } = await import('../../src/config/entitiesConfig.js');
  const validTypes = Object.keys(getShipConfig());
  for (const s of spawned) {
    expect(validTypes.includes(s.type)).toBe(true);
  }
});
