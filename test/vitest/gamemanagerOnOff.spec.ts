import { test, expect } from 'vitest';

test('manager on/off subscribe and unsubscribe works', async () => {
  // create a shim that never creates a real worker (force main-thread fallback)
  const shimFactory = () => { throw new Error('no worker'); };
  const { createGameManager } = await import('../../src/gamemanager');
  const gm: any = createGameManager({ renderer: null, createSimWorker: shimFactory });

  let called = 0;
  const cb = (m: any) => { called += 1; };
  gm.on('reinforcements', cb);

  // simulate an emission by calling stepOnce with forced reinforcement conditions
  // ensure continuous is enabled and set interval to 0 so it will fire on step
  gm.setReinforcementInterval(0.01);
  gm.setContinuousEnabled(true);

  // clear any ships and leave one team under threshold to trigger spawning
  gm._internal.state.ships = [];

  // run one step which should emit reinforcements
  gm.stepOnce(0.02);
  expect(called).toBeGreaterThanOrEqual(1);

  // now unsubscribe and ensure subsequent emissions do not increment the counter
  gm.off('reinforcements', cb);
  const before = called;
  gm.stepOnce(0.02);
  expect(called).toBe(before);
});
