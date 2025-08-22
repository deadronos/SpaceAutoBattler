import { test, expect } from 'vitest';

test('continuous reinforcements choose types from configured shipTypes', async () => {
  const { createGameManager } = await import('../../src/gamemanager.js');
  const gm: any = createGameManager({ renderer: null, createSimWorker: () => { throw new Error('no worker'); } });

  let captured: any = null;
  gm.on('reinforcements', (m: any) => { captured = m; });

  // deterministic RNG
  const { srand } = await import('../../src/rng.js');
  srand(123);

  // set continuous behavior to prefer specific types
  gm.setContinuousOptions({ shipTypes: ['corvette', 'frigate'], perTick: 3, scoreMargin: 0.01 });
  gm.setReinforcementInterval(0.01);
  gm.setContinuousEnabled(true);

  // make one team clearly stronger so the other will be reinforced
  gm._internal.state.ships = [];
  for (let i = 0; i < 5; i++) gm._internal.state.ships.push({ id: 2000 + i, type: 'fighter', team: 'blue', hp: 10 });

  // step once to trigger reinforcements
  gm.stepOnce(0.02);

  expect(captured).not.toBeNull();
  expect(Array.isArray(captured.spawned)).toBe(true);
  expect(captured.spawned.length).toBeGreaterThanOrEqual(1);

  // debug: log spawned types to help diagnose random selection
  // eslint-disable-next-line no-console
  console.log('spawned types:', captured.spawned.map((s: any) => s.type));
  const allowed = new Set(['corvette', 'frigate']);
  for (const s of captured.spawned) {
    expect(allowed.has(s.type)).toBe(true);
  }

  // diagnostics getter should reflect last reinforcement
  const diag = gm.getLastReinforcement();
  expect(diag).not.toBeNull();
  expect(Array.isArray(diag.spawned)).toBe(true);
  expect(diag.spawned.length).toBe(captured.spawned.length);

  // Also call chooseReinforcements directly to ensure orders come from shipTypes
  const { chooseReinforcements } = await import('../../src/config/teamsConfig.js');
  const orders = chooseReinforcements(123, gm._internal.state, { shipTypes: ['corvette', 'frigate'], perTick: 3, scoreMargin: 0.01, bounds: gm._internal.bounds, enabled: true });
  // eslint-disable-next-line no-console
  console.log('direct orders:', orders);
  // eslint-disable-next-line no-console
  // @ts-ignore
  console.log('chooseReinforcements._lastCfg:', chooseReinforcements._lastCfg);
  // eslint-disable-next-line no-console
  // @ts-ignore
  console.log('chooseReinforcements._lastOrders:', chooseReinforcements._lastOrders);
  expect(Array.isArray(orders)).toBe(true);
  if (orders.length) {
    for (const o of orders) expect(['corvette', 'frigate'].includes(o.type)).toBe(true);
  }
});
