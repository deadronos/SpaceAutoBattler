import { test, expect } from 'vitest';

test('getLastReinforcement includes continuousOptions snapshot', async () => {
  const { createGameManager } = await import('../../src/gamemanager.js');
  const gm: any = createGameManager({ renderer: null, createSimWorker: () => { throw new Error('no worker'); } });

  // deterministic RNG
  const { srand } = await import('../../src/rng.js');
  srand(555);

  // set continuous behavior options and enable
  const opts = { shipTypes: ['corvette', 'frigate'], perTick: 2, scoreMargin: 0.02 };
  gm.setContinuousOptions(opts);
  gm.setReinforcementInterval(0.01);
  gm.setContinuousEnabled(true);

  // make one team stronger so the other will be reinforced
  gm._internal.state.ships = [];
  for (let i = 0; i < 4; i++) gm._internal.state.ships.push({ id: 3000 + i, type: 'fighter', team: 'blue', hp: 10 });

  // step once to trigger reinforcements
  gm.stepOnce(0.02);

  const diag = gm.getLastReinforcement();
  expect(diag).not.toBeNull();
  expect(diag.options).toBeTruthy();
  // options snapshot should contain the keys we set
  expect(diag.options.shipTypes).toEqual(opts.shipTypes);
  expect(diag.options.perTick).toBe(opts.perTick);
  expect(typeof diag.options.scoreMargin).toBe('number');
  expect(diag.spawned.length).toBeGreaterThanOrEqual(1);
});